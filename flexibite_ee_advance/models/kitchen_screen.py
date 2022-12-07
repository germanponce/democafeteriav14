# -*- coding: utf-8 -*-
#################################################################################
# Author      : Acespritech Solutions Pvt. Ltd. (<www.acespritech.com>)
# Copyright(c): 2012-Present Acespritech Solutions Pvt. Ltd.
# All Rights Reserved.
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#################################################################################

import psycopg2
import pytz
from odoo import models, fields, api, tools, _
from odoo.tools import float_is_zero, float_round
from odoo.exceptions import UserError
from datetime import timedelta, datetime, timezone
from dateutil.tz import tzutc, tzlocal
import logging

_logger = logging.getLogger(__name__)

line_state = {'Waiting': 1, 'Preparing': 2, 'Delivering': 3, 'Delivering': 4, 'Done': 5}


def start_end_date_global(start, end, tz):
    tz = pytz.timezone(tz) or 'UTC'
    current_time = datetime.now(tz)
    hour_tz = int(str(current_time)[-5:][:2])
    min_tz = int(str(current_time)[-5:][3:])
    sign = str(current_time)[-6][:1]
    sdate = start + " 00:00:00"
    edate = end + " 23:59:59"
    if sign == '-':
        start_date = (datetime.strptime(sdate, '%Y-%m-%d %H:%M:%S') + timedelta(hours=hour_tz,
                                                                                minutes=min_tz)).strftime(
            "%Y-%m-%d %H:%M:%S")
        end_date = (datetime.strptime(edate, '%Y-%m-%d %H:%M:%S') + timedelta(hours=hour_tz,
                                                                              minutes=min_tz)).strftime(
            "%Y-%m-%d %H:%M:%S")
    if sign == '+':
        start_date = (datetime.strptime(sdate, '%Y-%m-%d %H:%M:%S') - timedelta(hours=hour_tz,
                                                                                minutes=min_tz)).strftime(
            "%Y-%m-%d %H:%M:%S")
        end_date = (datetime.strptime(edate, '%Y-%m-%d %H:%M:%S') - timedelta(hours=hour_tz,
                                                                              minutes=min_tz)).strftime(
            "%Y-%m-%d %H:%M:%S")
    return start_date, end_date


class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.depends('amount_total', 'amount_paid')
    def _compute_amount_due(self):
        for each in self:
            each.amount_due = (each.amount_total - each.amount_paid) + each.change_amount_for_wallet

    cancel_order_reason = fields.Text('Cancel Reason', readonly=True)
    change_amount_for_wallet = fields.Float('Wallet Amount')  # store wallet amount
    amount_due = fields.Float("Amount Due", compute="_compute_amount_due")

    order_type = fields.Selection([('Dine In', 'Dine In'), ('Take Away', 'Take Away'), ('Delivery', 'Delivery')],
                                  string="Order Type")
    order_state = fields.Selection(
        [("Start", "Start"), ("Done", "Done"), ("Deliver", "Deliver"), ("Complete", "Complete")], default="Start")
    send_to_kitchen = fields.Boolean('Send to Kitchen', readonly=True)
    increment_number = fields.Char(string="Increment Number")
    delivery_service_id = fields.Many2one('pos.delivery.service', string="Delivery Service")

    def _get_fields_for_order_line(self):
        res = super(PosOrder, self)._get_fields_for_order_line()
        if isinstance(res, list):
            res.append('state')
            res.append('line_cid')
        return res

    def _get_fields_for_draft_order(self):
        res = super(PosOrder, self)._get_fields_for_draft_order()
        if isinstance(res, list):
            res.append('send_to_kitchen')
            res.append('order_state')
        return res

    def action_pos_order_paid(self):
        self.ensure_one()
        if self.config_id.enable_wallet:
            if not self.config_id.cash_rounding:
                total = self.amount_total
            else:
                total = float_round(0, precision_rounding=self.config_id.rounding_method.rounding,
                                    rounding_method=self.config_id.rounding_method.rounding_method)
            if not float_is_zero(0, precision_rounding=self.currency_id.rounding):
                raise UserError(_("Order %s is not fully paid.", self.name))

            self.write({'state': 'paid'})
        res = super(PosOrder, self).action_pos_order_paid()
        if res:
            kitchen_user_ids = self.env['res.users'].search(
                [('kitchen_screen_user', 'in', ['cook', 'manager', 'waiter'])])
            notifications = []
            if kitchen_user_ids:
                for kitchen_user_id in kitchen_user_ids:
                    notify_data = {
                        'remove_order': self.id,
                    }
                    notifications.append(((self._cr.dbname, 'pos.order.line', kitchen_user_id.id),
                                          {'remove_order': self.id}))
            if notifications:
                self.env['bus.bus'].sendmany(notifications)
        return res

    @api.model
    def _process_order(self, order, draft, existing_order):
        submitted_references = order['data']['name']
        draft_order_id = self.search([('pos_reference', '=', submitted_references)]).id
        pos_session = self.env['pos.session'].browse(order.get('data').get('pos_session_id'))
        pos_session.update({'increment_number': order.get('data').get('increment_number')})
        if draft_order_id:
            to_invoice = order['to_invoice'] if not draft else False
            order = order['data']
            existing_order = self.browse([draft_order_id])

            pos_session = self.env['pos.session'].browse(order['pos_session_id'])
            if pos_session.state == 'closing_control' or pos_session.state == 'closed':
                order['pos_session_id'] = self._get_valid_session(order).id

            if existing_order:
                existing_order.lines.unlink()

                order['user_id'] = existing_order.user_id.id
                order['name'] = existing_order.pos_reference
                existing_order.write(self._order_fields(order))

            self._process_payment_lines(order, existing_order, pos_session, draft)
            if order.get('send_to_kitchen') or not order.get('table_id'):
                self.broadcast_order_data(True)
            if not draft:
                try:
                    existing_order.action_pos_order_paid()
                    self.broadcast_order_data(True)
                except psycopg2.DatabaseError:
                    # do not hide transactional errors, the order(s) won't be saved!
                    raise
                except Exception as e:
                    _logger.error('Could not fully process the POS Order: %s', tools.ustr(e))

            if to_invoice:
                existing_order.action_pos_order_invoice()
                existing_order.account_move.sudo().with_context(force_company=self.env.user.company_id.id).post()
            if order and order.get('delete_product') and order.get('server_id') and order.get('cancle_product_reason'):
                order_id = self.browse(order.get('server_id'))
                reason = order.get('cancle_product_reason')
                order_id.write({
                    'line_cancel_reason_ids': [(0, 0, {
                        'pos_order_id': order_id.id,
                        'product_id': reason.get('product'),
                        'reason': reason.get('reason_id'),
                        'description': reason.get('description'),
                    })],
                })
            self.broadcast_order_data(True)
            return existing_order.id

        if not draft_order_id:
            order_id = super(PosOrder, self)._process_order(order, draft, existing_order)
            if order_id:
                pos_order_id = self.browse(order_id)
                if order['data']['wallet_type']:
                    self.wallet_management(order['data'], pos_order_id)
                if order.get('data').get('giftcard') or order.get('data').get('redeem') or order.get('data').get(
                        'recharge'):
                    self.gift_card_management(order['data'], pos_order_id)
                if order.get('data').get('voucher_redeem'):
                    self.gift_voucher_management(order['data'])
            self.broadcast_order_data(True)
            return order_id

    def wallet_management(self, data, pos_order_id):
        if data.get('change_amount_for_wallet'):
            session_id = pos_order_id.session_id
            cash_register_id = session_id.cash_register_id
            if not cash_register_id:
                raise Warning(_('There is no cash register for this PoS Session'))
            cash_bocx_out_obj = self.env['cash.box.out'].create(
                {'name': 'Credit', 'amount': data.get('change_amount_for_wallet')})
            cash_bocx_out_obj.with_context({'partner_id': pos_order_id.partner_id.id})._run(cash_register_id)
            vals = {
                'customer_id': pos_order_id.partner_id.id,
                'type': data.get('wallet_type'),
                'order_id': pos_order_id.id,
                'credit': data.get('change_amount_for_wallet'),
                'cashier_id': data.get('user_id'),
            }
            self.env['wallet.management'].create(vals)
        elif data.get('used_amount_from_wallet'):
            vals = {
                'customer_id': pos_order_id.partner_id.id,
                'type': data.get('wallet_type'),
                'order_id': pos_order_id.id,
                'debit': data.get('used_amount_from_wallet'),
                'cashier_id': data.get('user_id'),
            }
            self.env['wallet.management'].create(vals)
        else:
            vals = {
                'customer_id': pos_order_id.partner_id.id,
                'order_id': pos_order_id.id,
                'credit': data.get('lines')[0][2].get('price_subtotal_incl'),
                'cashier_id': data.get('user_id'),
            }
            self.env['wallet.management'].create(vals)

    def gift_voucher_management(self, data):
        voucher_redeem_details = data.get('voucher_redeem')
        self.env['aspl.gift.voucher.redeem'].create(voucher_redeem_details)

    def gift_card_management(self, data, pos_order_id):
        for create_details in data.get('giftcard'):
            if create_details.get("expire_date") and create_details.get("customer_id"):
                self.env['aspl.gift.card'].create(create_details)
        if data.get('redeem') and pos_order_id:
            redeem_details = data.get('redeem')
            redeem_vals = {
                'pos_order_id': pos_order_id.id,
                'order_date': pos_order_id.date_order,
                'customer_id': redeem_details.get('card_customer_id') or False,
                'card_id': redeem_details.get('redeem_card_no'),
                'amount': redeem_details.get('redeem_card_amount'),
            }
            use_giftcard = self.env['aspl.gift.card.use'].create(redeem_vals)
            if use_giftcard:
                use_giftcard.card_id.write({'card_value': use_giftcard.card_id.card_value - use_giftcard.amount})

        # recharge giftcard
        if data.get('recharge'):
            recharge_details = data.get('recharge')
            recharge_vals = {
                'user_id': pos_order_id.user_id.id,
                'recharge_date': pos_order_id.date_order,
                'customer_id': recharge_details.get('card_customer_id') or False,
                'card_id': recharge_details.get('recharge_card_id'),
                'amount': recharge_details.get('recharge_card_amount'),
            }
            recharge_giftcard = self.env['aspl.gift.card.recharge'].create(recharge_vals)
            if recharge_giftcard:
                recharge_giftcard.card_id.write(
                    {'card_value': recharge_giftcard.card_id.card_value + recharge_giftcard.amount})

    @api.model
    def get_order_sync_data(self):
        pos_order_obj = self.search([('state', '=', 'draft')])
        sync_order_data = []
        for order in pos_order_obj:
            order_line_list = []
            combo_line_list = []
            for line in order.lines.filtered(lambda line: not line.is_combo_line):
                material_line_list = []
                combo_line_list = []
                for materialline in line.material_lines:
                    material_line = {
                        'id': materialline.id,
                        'name': materialline.product_id.display_name,
                        'qty': materialline.qty,
                        'replaced_product_name': materialline.replaced_product_id.display_name,
                        'max': materialline.max,
                        'bom': materialline.bom,
                    }
                    material_line_list.append(material_line)
                for comboline in line.combo_lines:
                    combo_line = {
                        'id': comboline.id,
                        'name': comboline.product_id.display_name,
                        'qty': comboline.qty,
                    }
                    material_line_list = []
                    for materialline in comboline.material_lines:
                        material_line = {
                            'id': materialline.id,
                            'name': materialline.product_id.display_name,
                            'qty': materialline.qty,
                            'replaced_product_name': materialline.replaced_product_id.display_name,
                            'max': materialline.max,
                            'bom': materialline.bom,
                        }
                        material_line_list.append(material_line)
                    combo_line.update({'materiallines': material_line_list})
                    combo_line_list.append(combo_line)
                order_line = {
                    'id': line.id,
                    'order_id': order.id,
                    'name': line.product_id.display_name,
                    'full_product_name': line.full_product_name,
                    'start_time': line.start_time,
                    'end_time': line.end_time,
                    'date_time_duration': line.date_time_duration,
                    'qty': line.qty,
                    'note': line.note,
                    'table': line.order_id.table_id.name,
                    'floor': line.order_id.table_id.floor_id.name,
                    'time': self.get_session_date(line),
                    'state': line.state,
                    'categ_id': line.product_id.product_tmpl_id.pos_categ_id.id,
                    'order_name': line.order_id.name,
                    'user': line.create_uid.id,
                    'route_id': line.product_id.product_tmpl_id.route_ids.active,
                    'order_type': order.order_type,
                    'materiallines': material_line_list,
                    'combolines': combo_line_list,
                    'increment_number': order.increment_number or 0,
                }
                order_line_list.append(order_line)
            order_dict = {
                'order_id': order.id,
                'order_name': order.name,
                'order_time': self.get_order_date(order),
                'order_datetime': order.date_order,
                'order_reference': order.pos_reference,
                'table': order.table_id.name,
                'floor': order.table_id.floor_id.name,
                'customer': order.partner_id.name,
                'order_lines': order_line_list,
                'total': order.amount_total,
                'note': order.note,
                'user_id': order.user_id.id,
                'user_name': order.user_id.name,
                'guests': order.customer_count,
                'order_type': order.order_type,
                'order_state': order.order_state,
                'state': order.state,
                'increment_number': order.increment_number or 0,
            }
            sync_order_data.append(order_dict)
        return sync_order_data

    @api.model
    def broadcast_order_data(self, new_order):
        notifications = []
        pos_order = self.search([('lines.state', 'not in', ['cancel', 'done']),
                                 ('amount_total', '>', 0.00), ('state', 'not in', ['cancel', 'done'])])
        screen_table_data = []
        for order in pos_order.filtered(lambda x: x.order_state != 'Complete'):
            order_line_list = []
            combo_line_list = []
            for line in order.lines.filtered(lambda line: not line.is_combo_line):
                material_line_list = []
                combo_line_list = []
                for materialline in line.material_lines:
                    material_line = {
                        'id': materialline.id,
                        'name': materialline.product_id.display_name,
                        'qty': materialline.qty,
                        'replaced_product_name': materialline.replaced_product_id.display_name,
                        'max': materialline.max,
                        'bom': materialline.bom,
                    }
                    material_line_list.append(material_line)
                for comboline in line.combo_lines:
                    combo_line = {
                        'id': comboline.id,
                        'name': comboline.product_id.display_name,
                        'qty': comboline.qty,
                    }
                    material_line_list = []
                    for materialline in comboline.material_lines:
                        material_line = {
                            'id': materialline.id,
                            'name': materialline.product_id.display_name,
                            'qty': materialline.qty,
                            'replaced_product_name': materialline.replaced_product_id.display_name,
                            'max': materialline.max,
                            'bom': materialline.bom,
                        }
                        material_line_list.append(material_line)
                    combo_line.update({'materiallines': material_line_list})
                    combo_line_list.append(combo_line)
                order_line = {
                    'id': line.id,
                    'order_id': order.id,
                    'name': line.product_id.display_name,
                    'full_product_name': line.full_product_name,
                    'start_time': line.start_time,
                    'end_time': line.end_time,
                    'date_time_duration': line.date_time_duration,
                    'qty': line.qty,
                    'note': line.note,
                    'table': line.order_id.table_id.name,
                    'floor': line.order_id.table_id.floor_id.name,
                    'time': self.get_session_date(line),
                    'state': line.state,
                    'categ_id': line.product_id.product_tmpl_id.pos_categ_id.id,
                    'order_name': line.order_id.name,
                    'user': line.create_uid.id,
                    'route_id': line.product_id.product_tmpl_id.route_ids.active,
                    'order_type': order.order_type,
                    'materiallines': material_line_list,
                    'combolines': combo_line_list,
                    'increment_number': order.increment_number or 0,
                }
                order_line_list.append(order_line)
            order_dict = {
                'order_id': order.id,
                'order_name': order.name,
                'order_time': self.get_order_date(order),
                'order_datetime': order.date_order,
                'order_reference': order.pos_reference,
                'table': order.table_id.name,
                'floor': order.table_id.floor_id.name,
                'customer': order.partner_id.name,
                'order_lines': order_line_list,
                'total': order.amount_total,
                'note': order.note,
                'user_id': order.user_id.id,
                'user_name': order.user_id.name,
                'guests': order.customer_count,
                'order_type': order.order_type,
                'order_state': order.order_state,
                'state': order.state,
                'increment_number': order.increment_number or 0,
            }
            screen_table_data.append(order_dict)
        screen_table_data = screen_table_data[::-1]
        kitchen_user_ids = self.env['res.users'].search([('kitchen_screen_user', 'in', ['cook', 'manager', 'waiter'])])
        sync_screen_data = self.get_order_sync_data()
        if kitchen_user_ids:
            for each_cook_id in kitchen_user_ids:
                notifications.append(
                    ((self._cr.dbname, 'pos.order.line', each_cook_id.id),
                     {
                         'screen_display_data': screen_table_data,
                         'sync_screen_data': sync_screen_data,
                         'new_order': new_order,
                         'manager': False if each_cook_id.kitchen_screen_user == 'cook' else True
                     }))
        if notifications:
            self.env['bus.bus'].sendmany(notifications)
        return sync_screen_data

    def get_session_date(self, line):
        sql = """SELECT create_date AT TIME ZONE 'GMT' as create_date from pos_order_line where id = %d
                   """ % line.id
        self._cr.execute(sql)
        data = self._cr.dictfetchall()
        time = data[0]['create_date']
        return str(time.hour) + ':' + str(time.minute) + ':' + str(time.second)

    def get_order_date(self, order):
        sql = """SELECT date_order AT TIME ZONE 'GMT' as date_order  from pos_order where id = %d
                       """ % order.id
        self._cr.execute(sql)
        data = self._cr.dictfetchall()
        time = data[0]['date_order']
        return str(time.hour) + ':' + str(time.minute) + ':' + str(time.second)

    # summery report 
    @api.model
    def order_summary_report(self, val):
        order_vals = {}
        category_list = {}
        payment_list = {}
        domain = []
        count = 0.00
        amount = 0.00
        if val.get('session_id'):
            domain = [('session_id.id', '=', val.get('session_id'))]
        else:
            local = pytz.timezone(self.env.user.tz)
            start_date = val.get('start_date') + " 00:00:00"
            start_date_time = datetime.strptime(start_date, "%Y-%m-%d %H:%M:%S")
            start_local_dt = local.localize(start_date_time, is_dst=None)
            start_utc_dt = start_local_dt.astimezone(pytz.utc)
            string_utc_date_time = start_utc_dt.strftime('%Y-%m-%d %H:%M:%S')

            end_date = val.get('end_date') + " 23:59:59"
            end_date_time = datetime.strptime(end_date, "%Y-%m-%d %H:%M:%S")
            end_local_dt = local.localize(end_date_time, is_dst=None)
            end_utc_dt = end_local_dt.astimezone(pytz.utc)
            string_end_utc_date_time = end_utc_dt.strftime('%Y-%m-%d %H:%M:%S')
            domain = [('date_order', '>=', string_utc_date_time), ('date_order', '<=', string_end_utc_date_time)]
        if val.get('state'):
            domain += [('state', '=', val.get('state'))]
        orders = self.search(domain)
        if ('order_summary_report' in val.get('summary') or len(val.get('summary')) == 0):
            if val.get('state'):
                order_vals[val.get('state')] = []
            else:
                for order_state in orders.mapped('state'):
                    order_vals[order_state] = []
            for each_order in orders:
                user_tz = self.env.user.tz
                order_date_tz = each_order.date_order.astimezone(pytz.timezone(user_tz))
                if each_order.state in order_vals:
                    order_vals[each_order.state].append({
                        'order_ref': each_order.name,
                        'order_date': order_date_tz,
                        'total': float(format(each_order.amount_total, '.2f'))
                    })
                else:
                    order_vals.update({
                        each_order.state.append({
                            'order_ref': each_order.name,
                            'order_date': order_date_tz,
                            'total': float(format(each_order.amount_total, '.2f'))
                        })
                    })
        if ('category_summary_report' in val['summary'] or len(val['summary']) == 0):
            if val.get('state'):
                category_list[val.get('state')] = {}
            else:
                for each_order in orders.mapped('state'):
                    category_list[each_order] = {}
            for order_line in orders.mapped('lines'):
                if order_line.order_id.state == 'paid':
                    if order_line.product_id.pos_categ_id.name in category_list[order_line.order_id.state]:
                        count = category_list[order_line.order_id.state][order_line.product_id.pos_categ_id.name][0]
                        amount = category_list[order_line.order_id.state][order_line.product_id.pos_categ_id.name][1]
                        count += order_line.qty
                        amount += order_line.price_subtotal_incl
                    else:
                        count = order_line.qty
                        amount = order_line.price_subtotal_incl
                if order_line.order_id.state == 'done':
                    if order_line.product_id.pos_categ_id.name in category_list[order_line.order_id.state]:
                        count = category_list[order_line.order_id.state][order_line.product_id.pos_categ_id.name][0]
                        amount = category_list[order_line.order_id.state][order_line.product_id.pos_categ_id.name][1]
                        count += order_line.qty
                        amount += order_line.price_subtotal_incl
                    else:
                        count = order_line.qty
                        amount = order_line.price_subtotal_incl
                if order_line.order_id.state == 'invoiced':
                    if order_line.product_id.pos_categ_id.name in category_list[order_line.order_id.state]:
                        count = category_list[order_line.order_id.state][order_line.product_id.pos_categ_id.name][0]
                        amount = category_list[order_line.order_id.state][order_line.product_id.pos_categ_id.name][1]
                        count += order_line.qty
                        amount += order_line.price_subtotal_incl
                    else:
                        count = order_line.qty
                        amount = order_line.price_subtotal_incl
                category_list[order_line.order_id.state].update(
                    {order_line.product_id.pos_categ_id.name: [count, amount]})
                if (False in category_list[order_line.order_id.state]):
                    category_list[order_line.order_id.state]['others'] = category_list[order_line.order_id.state].pop(
                        False)
        if ('payment_summary_report' in val['summary'] or len(val['summary']) == 0):
            if val.get('state'):
                payment_list[val.get('state')] = {}
            else:
                for each_order in orders.mapped('state'):
                    payment_list[each_order] = {}
            for payment_line in orders.mapped('payment_ids'):
                if payment_line.pos_order_id.state == 'paid':
                    if payment_line.payment_method_id.name in payment_list[payment_line.pos_order_id.state]:
                        count = payment_list[payment_line.pos_order_id.state][payment_line.payment_method_id.name]
                        count += payment_line.amount
                    else:
                        count = payment_line.amount
                if payment_line.pos_order_id.state == 'done':
                    if payment_line.payment_method_id.name in payment_list[payment_line.pos_order_id.state]:
                        count = payment_list[payment_line.pos_order_id.state][payment_line.payment_method_id.name]
                        count += payment_line.amount
                    else:
                        count = payment_line.amount
                if payment_line.pos_order_id.state == 'invoiced':
                    if payment_line.payment_method_id.name in payment_list[payment_line.pos_order_id.state]:
                        count = payment_list[payment_line.pos_order_id.state][payment_line.payment_method_id.name]
                        count += payment_line.amount
                    else:
                        count = payment_line.amount
                payment_list[payment_line.pos_order_id.state].update(
                    {payment_line.payment_method_id.name: float(format(count, '.2f'))})
        return {
            'order_report': order_vals,
            'category_report': category_list,
            'payment_report': payment_list,
            'state': val['state'] or False
        }

    @api.model
    def product_summary_report(self, val):
        product_summary_dict = {}
        category_summary_dict = {}
        payment_summary_dict = {}
        location_summary_dict = {}
        if val.get('session_id'):
            domain = [('session_id.id', '=', val.get('session_id'))]
        else:
            local = pytz.timezone(self.env.user.tz)
            start_date = val.get('start_date') + " 00:00:00"
            start_date_time = datetime.strptime(start_date, "%Y-%m-%d %H:%M:%S")
            start_local_dt = local.localize(start_date_time, is_dst=None)
            start_utc_dt = start_local_dt.astimezone(pytz.utc)
            string_utc_date_time = start_utc_dt.strftime('%Y-%m-%d %H:%M:%S')

            end_date = val.get('end_date') + " 23:59:59"
            end_date_time = datetime.strptime(end_date, "%Y-%m-%d %H:%M:%S")
            end_local_dt = local.localize(end_date_time, is_dst=None)
            end_utc_dt = end_local_dt.astimezone(pytz.utc)
            string_end_utc_date_time = end_utc_dt.strftime('%Y-%m-%d %H:%M:%S')
            domain = [('date_order', '>=', string_utc_date_time), ('date_order', '<=', string_end_utc_date_time)]
        order_detail = self.search(domain)
        if order_detail:
            product_qty = 0
            location_qty = 0
            category_qty = 0
            payment = 0
            if ('product_summary' in val.get('summary') or len(val.get('summary')) == 0):
                for each_order_line in order_detail.mapped('lines'):
                    if each_order_line.product_id.name in product_summary_dict:
                        product_qty = product_summary_dict[each_order_line.product_id.name]
                        product_qty += each_order_line.qty
                    else:
                        product_qty = each_order_line.qty
                    product_summary_dict[each_order_line.product_id.name] = product_qty;

            if ('category_summary' in val.get('summary') or len(val.get('summary')) == 0):
                for each_order_line in order_detail.mapped('lines'):
                    if each_order_line.product_id.pos_categ_id.name in category_summary_dict:
                        category_qty = category_summary_dict[each_order_line.product_id.pos_categ_id.name]
                        category_qty += each_order_line.qty
                    else:
                        category_qty = each_order_line.qty
                    category_summary_dict[each_order_line.product_id.pos_categ_id.name] = category_qty;
                if (False in category_summary_dict):
                    category_summary_dict['Others'] = category_summary_dict.pop(False);

            if ('payment_summary' in val.get('summary') or len(val.get('summary')) == 0):
                for payment_line in order_detail.mapped('payment_ids'):
                    if payment_line.payment_method_id.name in payment_summary_dict:
                        payment = payment_summary_dict[payment_line.payment_method_id.name]
                        payment += payment_line.amount
                    else:
                        payment = payment_line.amount
                    payment_summary_dict[payment_line.payment_method_id.name] = float(format(payment, '2f'))

            if ('location_summary' in val.get('summary') or len(val.get('summary')) == 0):
                stock_picking_data = False
                stock_picking_data = self.env['stock.picking'].sudo().search(
                    [('pos_session_id', 'in', order_detail.mapped('session_id').ids)])

                if stock_picking_data:
                    for each_stock in stock_picking_data:
                        location_summary_dict[each_stock.location_id.name] = {}
                    # for each_stock in stock_picking_data:
                    for each_stock_line in stock_picking_data.mapped('move_ids_without_package'):
                        if each_stock_line.product_id.name in location_summary_dict[
                            each_stock_line.picking_id.location_id.name]:
                            location_qty = location_summary_dict[each_stock_line.picking_id.location_id.name][
                                each_stock_line.product_id.name]
                            location_qty += each_stock_line.quantity_done
                        else:
                            location_qty = each_stock_line.quantity_done
                        location_summary_dict[each_stock_line.picking_id.location_id.name][
                            each_stock_line.product_id.name] = location_qty

        return {
            'product_summary': product_summary_dict,
            'category_summary': category_summary_dict,
            'payment_summary': payment_summary_dict,
            'location_summary': location_summary_dict,
        }

    @api.model
    def prepare_payment_summary_data(self, row_data, key):
        payment_details = {}
        summary_data = {}

        for each in row_data:
            if key == 'journals':
                payment_details.setdefault(each['month'], {})
                payment_details[each['month']].update({each['name']: each['amount']})
                summary_data.setdefault(each['name'], 0.0)
                summary_data.update({each['name']: summary_data[each['name']] + each['amount']})
            else:
                payment_details.setdefault(each['login'], {})
                payment_details[each['login']].setdefault(each['month'], {each['name']: 0})
                payment_details[each['login']][each['month']].update({each['name']: each['amount']})

        return [payment_details, summary_data]

    @api.model
    def payment_summary_report(self, vals):
        sql = False
        final_data_dict = dict.fromkeys(
            ['journal_details', 'salesmen_details', 'summary_data'], {})
        current_time_zone = self.env.user.tz or 'UTC'
        if vals.get('session_id'):
            if vals.get('summary') == 'journals':
                sql = """ SELECT
                                REPLACE(CONCAT(to_char(to_timestamp(
                                EXTRACT(month FROM pp.payment_date AT TIME ZONE 'UTC' AT TIME ZONE '%s')::text, 'MM'),'Month'),
                                '-',EXTRACT(year FROM pp.payment_date AT TIME ZONE 'UTC' AT TIME ZONE '%s')),
                                ' ', '') AS month,
                                ppm.name, ppm.id,
                                SUM(pp.amount) AS amount
                                FROM pos_payment AS pp
                                INNER JOIN pos_payment_method AS ppm ON ppm.id = pp.payment_method_id
                                WHERE session_id = %s
                                GROUP BY month, ppm.name, ppm.id
                                ORDER BY month ASC
                            """ % (current_time_zone, current_time_zone, vals.get('session_id'))
            if vals.get('summary') == 'sales_person':
                sql = """ SELECT
                                REPLACE(CONCAT(to_char(to_timestamp(
                                EXTRACT(month FROM pp.payment_date AT TIME ZONE 'UTC' AT TIME ZONE '%s')::text, 'MM'), 'Month'), 
                                '-',EXTRACT(year FROM pp.payment_date AT TIME ZONE 'UTC' AT TIME ZONE '%s')),
                                ' ', '') AS month,
                                rp.name AS login, ppm.name, SUM(pp.amount) AS amount
                                FROM
                                pos_order AS po
                                INNER JOIN res_users AS ru ON ru.id = po.user_id
                                INNER JOIN res_partner AS rp ON rp.id = ru.partner_id
                                INNER JOIN pos_payment AS pp ON pp.pos_order_id = po.id
                                INNER JOIN pos_payment_method AS ppm ON ppm.id = pp.payment_method_id
                                WHERE
                                po.session_id = %s
                                GROUP BY ppm.name, rp.name, month""" % (
                    current_time_zone, current_time_zone, vals.get('session_id'))
        else:
            s_date, e_date = start_end_date_global(vals.get('start_date'), vals.get('end_date'), current_time_zone)
            if vals.get('summary') == 'journals':
                sql = """ SELECT
                                REPLACE(CONCAT(to_char(to_timestamp(
                                EXTRACT(month FROM pp.payment_date AT TIME ZONE 'UTC' AT TIME ZONE '%s')::text, 'MM'),'Month'),
                                '-',EXTRACT(year FROM pp.payment_date AT TIME ZONE 'UTC' AT TIME ZONE '%s')),
                                ' ', '') AS month,
                                ppm.name, ppm.id,
                                SUM(pp.amount) AS amount
                                FROM pos_payment AS pp
                                INNER JOIN pos_payment_method AS ppm ON ppm.id = pp.payment_method_id
                                WHERE payment_date BETWEEN  '%s' AND '%s'
                                GROUP BY month, ppm.name, ppm.id
                                ORDER BY month ASC
                            """ % (current_time_zone, current_time_zone, s_date, e_date)

            if vals.get('summary') == 'sales_person':
                sql = """ SELECT
                                REPLACE(CONCAT(to_char(to_timestamp(
                                EXTRACT(month FROM pp.payment_date AT TIME ZONE 'UTC' AT TIME ZONE '%s')::text, 'MM'), 'Month'), 
                                '-',EXTRACT(year FROM pp.payment_date AT TIME ZONE 'UTC' AT TIME ZONE '%s')),
                                ' ', '') AS month,
                                rp.name AS login, ppm.name, SUM(pp.amount) AS amount
                                FROM
                                pos_order AS po
                                INNER JOIN res_users AS ru ON ru.id = po.user_id
                                INNER JOIN res_partner AS rp ON rp.id = ru.partner_id
                                INNER JOIN pos_payment AS pp ON pp.pos_order_id = po.id
                                INNER JOIN pos_payment_method AS ppm ON ppm.id = pp.payment_method_id
                                WHERE
                                po.date_order BETWEEN '%s' AND '%s'
                                GROUP BY ppm.name, rp.name, month""" % (
                    current_time_zone, current_time_zone, s_date, e_date)
        if sql:
            self._cr.execute(sql)
            sql_result = self._cr.dictfetchall()

            if sql_result:
                result = self.prepare_payment_summary_data(sql_result, vals.get('summary'))
                if vals.get('summary') == 'journals':
                    final_data_dict.update({'journal_details': result[0], 'summary_data': result[1]})
                    return final_data_dict
                else:
                    final_data_dict.update({'salesmen_details': result[0]})
                    return final_data_dict
            else:
                return final_data_dict
        else:
            return final_data_dict


class PosOrderLines(models.Model):
    _inherit = "pos.order.line"

    @api.model
    def update_orderline_state(self, vals):
        order_line = self.browse(vals['order_line_id'])
        order = self.env['pos.order'].browse(vals['order_id'])
        tz = pytz.timezone(self.env.user.tz) or 'UTC'
        current_time = datetime.now(tz).time()
        current_float_time = current_time.hour + current_time.minute / 60.0
        if line_state[vals['state']] >= line_state[order_line.state]:
            order_line.sudo().write({
                'state': vals['state']
            })
            if vals['state'] == 'Preparing':
                order_line.sudo().write({
                    'start_time': current_float_time
                })
            if vals['state'] == 'Delivering':
                start = '{0:02.0f}:{1:02.0f}'.format(*divmod(order_line.sudo().start_time * 60, 60))
                end = '{0:02.0f}:{1:02.0f}'.format(*divmod(current_float_time * 60, 60))
                duration = datetime.strptime(end, "%H:%M") - datetime.strptime(start, "%H:%M")
                duration_seconds = duration.total_seconds()
                duration_minut = duration_seconds / 60
                duration_hours = duration_minut / 60
                order_line.sudo().write({
                    'end_time': current_float_time,
                    'date_time_duration': duration_hours,
                })
            vals['pos_reference'] = order_line.order_id.pos_reference
            if order_line.mo_id:
                mo_id = self.env['mrp.production'].browse([order_line.mo_id])
                if vals['state'] == 'Preparing':
                    mo_id.sudo().write({'qty_producing': order_line.qty})
                    mo_id.sudo().action_confirm()
                if vals['state'] == 'Delivering':
                    mo_id.sudo().with_context(skip_consumption=True).button_mark_done()

            for line in order_line.combo_lines:
                if vals['state'] == 'Preparing':
                    mo_id = self.env['mrp.production'].browse([line.mo_id])
                    mo_id.sudo().action_confirm()
                    mo_id.sudo().write({'qty_producing': int(line.qty * order_line.qty)})
            if vals['state'] == 'Delivering':
                for line in order_line.combo_lines.filtered(lambda cl: cl.mo_id != 0):
                    mo_id = self.env['mrp.production'].browse([line.mo_id])
                    mo_id.sudo().with_context(skip_consumption=True).button_mark_done()

        state_list = [line.state for line in order.lines if not line.is_combo_line]

        if 'Waiting' in state_list:
            order_state = 'Start'
            order.sudo().write({'order_state': order_state})
        elif 'Preparing' in state_list:
            order_state = 'Done'
            order.sudo().write({'order_state': order_state})
        else:
            order_state = 'Deliver'
            order.sudo().write({'order_state': order_state})
        order.broadcast_order_data(False)
        vals.update({
            'server_id': order_line.id,
            'product_id': order_line.product_id.id,
            'start_time': order_line.start_time,
            'end_time': order_line.end_time,
            'date_time_duration': order_line.date_time_duration,
        })
        notifications = [((self._cr.dbname, 'pos.order.line', order_line.create_uid.id), {'order_line_state': vals})]
        self.env['bus.bus'].sendmany(notifications)

    @api.model
    def update_all_orderline_state(self, vals):
        order = self.env['pos.order'].browse(vals['order_id'])
        order.sudo().write({'order_state': vals['order_state']})
        tz = pytz.timezone(self.env.user.tz) or 'UTC'
        current_time = datetime.now(tz).time()
        current_float_time = current_time.hour + current_time.minute / 60.0
        for line in order.lines:
            if line_state and line_state.get(vals['line_state']) and line_state.get(line.state) and line_state.get(
                    vals['line_state']) >= line_state.get(line.state):
                notifications = []
                line.sudo().write({'state': vals['line_state']})
                if vals['line_state'] == 'Preparing':
                    line.sudo().write({
                        'start_time': current_float_time
                    })
                if vals['line_state'] == 'Delivering':
                    start = '{0:02.0f}:{1:02.0f}'.format(*divmod(line.sudo().start_time * 60, 60))
                    end = '{0:02.0f}:{1:02.0f}'.format(*divmod(current_float_time * 60, 60))
                    duration = datetime.strptime(end, "%H:%M") - datetime.strptime(start, "%H:%M")
                    duration_seconds = duration.total_seconds()
                    duration_minut = duration_seconds / 60
                    duration_hours = duration_minut / 60
                    line.sudo().write({
                        'end_time': current_float_time,
                        'date_time_duration': duration_hours
                    })
                vals['pos_reference'] = line.order_id.pos_reference
                if line.mo_id:
                    mo_id = self.env['mrp.production'].browse([line.mo_id])
                    if mo_id and vals['line_state'] == 'Preparing':
                        mo_id.sudo().action_confirm()
                        mo_id.sudo().action_assign()
                        mo_id.sudo().write({'qty_producing': line.qty})
                    if mo_id and vals['line_state'] == 'Delivering':
                        mo_id.sudo().with_context(skip_consumption=True).button_mark_done()
                if line.combo_lines:
                    if vals['line_state'] == 'Preparing':
                        for m_line in line.combo_lines.filtered(lambda cl: cl.mo_id != 0):
                            mo_id = self.env['mrp.production'].browse([m_line.mo_id])
                            mo_id.sudo().action_confirm()
                            mo_id.sudo().write({'qty_producing': int(m_line.qty * line.qty)})
                    if vals['line_state'] == 'Delivering':
                        for m_line in line.combo_lines.filtered(lambda cl: cl.mo_id != 0):
                            mo_id = self.env['mrp.production'].browse([m_line.mo_id])
                            mo_id.sudo().with_context(skip_consumption=True).button_mark_done()
                vals.update({
                    'server_id': line.id,
                    'product_id': line.product_id.id,
                    'state': vals['line_state'],
                    'start_time': line.start_time,
                    'end_time': line.end_time,
                })
                vals['server_id'] = line.id
                vals['state'] = vals['line_state']
                vals['line_cid'] = line.line_cid
                notifications.append(
                    [(self._cr.dbname, 'pos.order.line', line.create_uid.id), {'order_line_state': vals}])
                if len(notifications) > 0:
                    self.env['bus.bus'].sendmany(notifications)
        order.broadcast_order_data(False)
        return True

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
