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

from odoo import models, fields, api, _
from functools import partial
from itertools import groupby
from ast import literal_eval
from datetime import timedelta, datetime


class PosOrder(models.Model):
    _inherit = 'pos.order'

    back_order_reference = fields.Char('Back Order Receipt', readonly="1")
    line_cancel_reason_ids = fields.One2many('order.line.cancel.reason', 'pos_order_id', string="Line Cancel Reason")

    @api.model
    def cancel_pos_order(self, order_id, cancel_reason):
        order_obj = self.browse(order_id)
        order_obj.sudo().write({'state': 'cancel', 'cancel_order_reason': cancel_reason or ''})
        kitchen_user_ids = self.env['res.users'].search(
            [('kitchen_screen_user', 'in', ['cook', 'manager', 'waiter'])])
        notifications = []
        if kitchen_user_ids:
            for kitchen_user_id in kitchen_user_ids:
                notify_data = {
                    'cancel_order': order_obj.id,
                }
                notifications.append(((self._cr.dbname, 'pos.order.line', kitchen_user_id.id),
                                      {'cancel_order': order_obj.id}))
        if notifications:
            self.env['bus.bus'].sendmany(notifications)
        self.broadcast_order_data(False)
        return True

    @api.model
    def _order_fields(self, ui_order):
        res = super(PosOrder, self)._order_fields(ui_order)
        new_order_line = []
        state_list = []
        process_line = partial(self.env['pos.order.line']._order_line_fields, session_id=ui_order['pos_session_id'])
        for line in ui_order['lines']:
            combo_lines = []
            material_lines = []
            mo_id = False
            for comboline in line[2]['combolines']:
                comboline['price_subtotal'] = 0
                comboline['price_unit'] = 0
                comboline['price_subtotal_incl'] = 0
                comboline['tax_ids'] = [(6, 0, [])]
                comboline['product_id'] = int(comboline['replaced_product_id']) if comboline['is_replaced'] else int(
                    comboline['product_id'])
                comboline.update({'is_combo_line': True})
                new_order_line.append([0, 0, comboline])
                if len(comboline['materiallines']) != 0:
                    if comboline['bom_id'] and comboline['product_id']:
                        product_id = self.env['product.product'].browse(int(comboline['product_id']))
                        if not comboline['mo_id']:

                            mo_id = self.env['mrp.production'].create({
                                'product_id': product_id.id,
                                'product_qty': comboline['qty'],
                                'product_uom_id': product_id.uom_id.id,
                                'bom_id': int(comboline['bom_id']),
                            })
                            comboline.update({'mo_id': mo_id.id})
                            mo_id._onchange_move_raw()
                            mo_id._onchange_move_finished()
                        else:
                            mo_id = self.env['mrp.production'].browse(comboline['mo_id'])
                        if mo_id.state == 'draft':
                            mo_id.move_raw_ids.unlink()
                    move_raw_ids = []
                    material_lines = []
                    for materialline in comboline['materiallines']:
                        p_id = int(materialline['replaced_product_id']) if materialline['is_replaced'] else int(
                            materialline['product_id'])
                        product_id = self.env['product.product'].browse(p_id)
                        materialline['price_subtotal'] = 0
                        materialline['price_unit'] = 0
                        materialline['price_subtotal_incl'] = 0
                        move_raw_ids.append([0, 0, {'product_id': product_id.id, 'name': product_id.name,
                                                    'product_uom_qty': int(
                                                        materialline.get('qty') * comboline['qty'] * line[2]['qty']),
                                                    'product_uom': product_id.uom_id.id,
                                                    'location_id': mo_id.location_src_id.id,
                                                    'location_dest_id': mo_id.location_dest_id.id,
                                                    'quantity_done': int(
                                                        materialline.get('qty') * comboline['qty'] * line[2]['qty'])}])
                        material_lines.append([0, 0, {'product_id': materialline['product_id'],
                                                      'qty': materialline['qty'],
                                                      'price': materialline['price_unit'],
                                                      'product_uom_id': self.env['product.product'].browse(int(
                                                          materialline['product_id'])).uom_id.id,
                                                      'full_product_name': materialline['full_product_name'],
                                                      'bom': materialline['bom'],
                                                      'replaced_product_id': materialline['replaced_product_id'],
                                                      'max': materialline['max'],
                                                      'replaceable': materialline['replaceable'],
                                                      'replaceable_ids': materialline['replaceable_ids'],
                                                      'is_replaced': materialline['is_replaced']
                                                      }])
                    if mo_id.state == 'draft':
                        mo_id.write({'move_raw_ids': move_raw_ids})
                comboline.update({'material_lines': material_lines})
                material_lines = []
                combo_lines.append([0, 0, {'product_id': comboline['product_id'],
                                           'qty': comboline['qty'],
                                           'price': comboline['price_unit'],
                                           'full_product_name': comboline['full_product_name'],
                                           'material_lines': comboline['material_lines'],
                                           'bom_id': comboline['bom_id'],
                                           'categoryName': comboline['categoryName'],
                                           'categoryId': comboline['categoryId'],
                                           'replaceable': comboline['replaceable'],
                                           'replacePrice': comboline['replacePrice'],
                                           'customisePrice': comboline['customisePrice'],
                                           'require': comboline['require'],
                                           'max': comboline['max'],
                                           'is_replaced': comboline['is_replaced'],
                                           'replaced_product_id': comboline['replaced_product_id'],
                                           'mo_id': comboline['mo_id'],
                                           }])
            if line[2]['materiallines']:
                if line[2]['bom_id'] and line[2]['product_id']:
                    product_id = self.env['product.product'].browse(int(line[2]['product_id']))
                    if not line[2]['mo_id']:
                        mo_id = self.env['mrp.production'].create({
                            'product_id': product_id.id,
                            'product_qty': line[2]['qty'],
                            'product_uom_id': product_id.uom_id.id,
                            'bom_id': int(line[2]['bom_id']),
                        })
                        mo_id.sudo()._onchange_move_raw()
                        line[2].update({'mo_id': mo_id})
                    else:
                        mo_id = self.env['mrp.production'].browse(line[2]['mo_id'])
                    if mo_id.state == 'draft':
                        mo_id.move_raw_ids.unlink()
                move_raw_ids = []
                material_lines = []
                for materialline in line[2]['materiallines']:
                    p_id = int(materialline['replaced_product_id']) if materialline['is_replaced'] else int(
                        materialline['product_id'])
                    product_id = self.env['product.product'].browse(p_id)
                    materialline['price_subtotal'] = 0
                    materialline['price_unit'] = 0
                    materialline['product_uom_id'] = materialline['product_uom_id'][0] if materialline[
                        'product_uom_id'] else product_id.uom_id.id
                    materialline['qty'] = materialline['qty']
                    move_raw_ids.append([0, 0, {'product_id': product_id.id, 'name': product_id.name,
                                                'product_uom_qty': int(materialline.get('qty') * line[2]['qty']),
                                                'product_uom': materialline['product_uom_id'],
                                                'location_id': mo_id.location_src_id.id,
                                                'location_dest_id': mo_id.product_id.with_company(
                                                    self.company_id).property_stock_production.id,
                                                'quantity_done': int(materialline.get('qty') * line[2]['qty'])}])
                    material_lines.append([0, 0, {'product_id': materialline['product_id'],
                                                  'qty': materialline['qty'],
                                                  'price': materialline['price_unit'],
                                                  'product_uom_id': materialline['product_uom_id'],
                                                  'full_product_name': materialline['full_product_name'],
                                                  'bom': materialline['bom'],
                                                  'replaced_product_id': materialline['replaced_product_id'],
                                                  'max': materialline['max'],
                                                  'replaceable': materialline['replaceable'],
                                                  'replaceable_ids': materialline['replaceable_ids'],
                                                  'is_replaced': materialline['is_replaced']
                                                  }])
                if mo_id.state == 'draft':
                    mo_id.write({'move_raw_ids': move_raw_ids})
                    mo_id.sudo()._onchange_move_finished()
            new_order_line.append(line)
            line[2].update({'material_lines': material_lines})
            line[2].update({'combo_lines': combo_lines})
            state_list.append(line[2]['state'])
        if 'Waiting' in state_list:
            order_state = 'Start'
        elif 'Preparing' in state_list:
            order_state = 'Done'
        else:
            order_state = 'Deliver'

        if ui_order and ui_order.get('refund_order'):
            if ui_order.get('refund_ref_order') and ui_order.get('refund_ref_order'):
                reference_order_id = self.search([('pos_reference', '=', ui_order.get('refund_ref_order'))], limit=1)
                res.update({
                    'name': reference_order_id.name + " REFUND",
                    'back_order_reference': ui_order.get('refund_ref_order'),
                })
        if ui_order and ui_order.get('delivery_service') and ui_order.get('delivery_service').get(
                'id') and ui_order.get('order_type') and ui_order.get('order_type') == 'Delivery':
            res.update({
                'delivery_service_id': ui_order.get('delivery_service').get('id')
            })
        res.update({
            'lines': [process_line(l) for l in new_order_line] if new_order_line else False,
            'order_type': ui_order.get('order_type') or False,
            'order_state': order_state,
            'change_amount_for_wallet': ui_order.get('change_amount_for_wallet') or 0.00,
            'amount_due': ui_order.get('amount_due'),
            'note': ui_order.get('order_note', False),
            'user_id': ui_order['cashier_id'] or False,
            'increment_number': ui_order.get('increment_number'),
        })
        return res

    @api.model
    def remove_mo(self, vals):
        mo_id = self.env['mrp.production'].browse(vals['mo_id'])
        if not vals['qty'] == 'remove' and len(vals['qty']) > 0:
            mo_id.sudo().write({'product_qty': int(vals['qty'])})
        elif vals['remove']:
            mo_id.unlink()

    def _get_fields_for_material_line(self):
        return [
            'id',
            'product_id',
            'price',
            'order_line_id',
            'combo_line_id',
            'qty',
            'max',
            'bom',
            'replaced_product_id',
            'full_product_name',
            'replaceable',
            'replaceable_ids',
            'is_replaced',
        ]

    def _get_material_lines(self, order_lines):
        materiallines = self.env['pos.material.line'].search_read(
            domain=[('order_line_id', 'in', [order_line['id'] for order_line in order_lines])],
            fields=self._get_fields_for_material_line())
        for materialline in materiallines:
            materialline['order_line'] = materialline['order_line_id'][0]
            materialline['product_id'] = materialline['product_id'][0]
            materialline['replaced_product_id'] = materialline['replaced_product_id'][0] if materialline[
                'replaced_product_id'] else False
            materialline['server_id'] = materialline['id']
            materialline['replaceable_ids'] = [int(each) for each in literal_eval(materialline['replaceable_ids'])]
            del materialline['order_line_id']
            del materialline['id']
        for order_line_id, material_lines in groupby(materiallines, key=lambda x: x['order_line']):
            next(order_line for order_line in order_lines if order_line['id'] == order_line_id)[
                'material_lines'] = list(material_lines)

    def _get_combo_material_lines(self, combo_lines):
        materiallines = self.env['pos.material.line'].search_read(
            domain=[('combo_line_id', 'in', [combo_line['id'] for combo_line in combo_lines])],
            fields=self._get_fields_for_material_line())
        for materialline in materiallines:
            materialline['combo_line'] = materialline['combo_line_id'][0]
            materialline['product_id'] = materialline['product_id'][0]
            materialline['replaced_product_id'] = materialline['replaced_product_id'][0] if materialline[
                'replaced_product_id'] else False
            materialline['server_id'] = materialline['id']
            materialline['replaceable_ids'] = [int(each) for each in literal_eval(materialline['replaceable_ids'])]
            del materialline['combo_line_id']
            del materialline['id']
        for combo_line_id, material_lines in groupby(materiallines, key=lambda x: x['combo_line']):
            next(combo_line for combo_line in combo_lines if combo_line['id'] == combo_line_id)[
                'material_lines'] = list(material_lines)

    def _get_fields_for_combo_line(self):
        return [
            'id',
            'product_id',
            'price',
            'order_line_id',
            'qty',
            'max',
            'bom_id',
            'categoryName',
            'categoryId',
            'full_product_name',
            'require',
            'replaceable',
            'replacePrice',
            'customisePrice',
            'is_replaced',
            'replaced_product_id',
            'mo_id',
        ]

    def _get_combo_lines(self, order_lines):
        combo_lines = self.env['pos.combo.line'].search_read(
            domain=[('order_line_id', 'in', [order_line['id'] for order_line in order_lines])],
            fields=self._get_fields_for_combo_line())
        if combo_lines != []:
            self._get_combo_material_lines(combo_lines)

        extended_combo_lines = []
        for combo_line in combo_lines:
            combo_line['order_line'] = combo_line['order_line_id'][0]
            combo_line['product_id'] = combo_line['product_id'][0]
            combo_line['replaced_product_id'] = combo_line['replaced_product_id'][0] if combo_line[
                'replaced_product_id'] else False
            combo_line['server_id'] = combo_line['id']
            del combo_line['order_line_id']
            del combo_line['id']
            if not 'material_lines' in combo_line:
                combo_line['material_lines'] = []
            extended_combo_lines.append(combo_line)
        for order_line_id, combo_lines in groupby(extended_combo_lines, key=lambda x: x['order_line']):
            next(order_line for order_line in order_lines if order_line['id'] == order_line_id)['combo_lines'] = list(
                combo_lines)

    def _get_fields_for_order_line(self):
        return [
            'id',
            'discount',
            'product_id',
            'price_unit',
            'order_id',
            'qty',
            'note',
            'mp_skip',
            'mp_dirty',
            'full_product_name',
            'is_combo_line',
            'quantityLine',
            'useQuantityLine',
            'state',
            'mo_id',
            'start_time',
            'end_time',
            'date_time_duration',
        ]

    def _get_order_lines(self, orders):
        order_lines = self.env['pos.order.line'].search_read(
            domain=[('order_id', 'in', [to['id'] for to in orders])],
            fields=self._get_fields_for_order_line())
        if order_lines != []:
            self._get_pack_lot_lines(order_lines)
            self._get_material_lines(order_lines)
            self._get_combo_lines(order_lines)

        extended_order_lines = []
        for order_line in order_lines:
            if not order_line['is_combo_line']:
                order_line['product_id'] = order_line['product_id'][0]
                order_line['server_id'] = order_line['id']
                order_line['quantityLine'] = eval(order_line['quantityLine'])
                order_line['useQuantityLine'] = eval(order_line['useQuantityLine'])

                del order_line['id']
                if 'pack_lot_ids' not in order_line:
                    order_line['pack_lot_ids'] = []
                if 'material_lines' not in order_line:
                    order_line['material_lines'] = []
                if 'combo_lines' not in order_line:
                    order_line['combo_lines'] = []

                extended_order_lines.append([0, 0, order_line])

        for order_id, order_lines in groupby(extended_order_lines, key=lambda x: x[2]['order_id']):
            next(order for order in orders if order['id'] == order_id[0])['lines'] = list(order_lines)

    def _get_fields_for_draft_order(self):
        return [
            'id',
            'pricelist_id',
            'partner_id',
            'sequence_number',
            'session_id',
            'pos_reference',
            'create_uid',
            'create_date',
            'customer_count',
            'fiscal_position_id',
            'table_id',
            'to_invoice',
            'multiprint_resume',
            'order_type',
        ]


class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    state = fields.Selection(
        selection=[("Waiting", "Waiting"), ("Preparing", "Preparing"), ("Delivering", "Delivering"),
                   ("Done", "Done")], default="Waiting")
    material_lines = fields.One2many('pos.material.line', 'order_line_id', string='Material Lines',
                                     states={'draft': [('readonly', False)]},
                                     readonly=True, copy=True)
    is_combo_line = fields.Boolean(string="Is Combo Line", default=0)
    combo_lines = fields.One2many('pos.combo.line', 'order_line_id', string='Combo Lines',
                                  states={'draft': [('readonly', False)]},
                                  readonly=True, copy=True)
    quantityLine = fields.Text(string='Quantity Line of category')
    useQuantityLine = fields.Text(string='Use quantity Line Of Product')
    mo_id = fields.Integer(string='Manufacture Order Id', default=False)
    start_time = fields.Float(string='Start Time')
    end_time = fields.Float(string='End Time')
    date_time_duration = fields.Float(string='Duration')
    line_cid = fields.Char('Line cid')


class PosMaterialLine(models.Model):
    _name = "pos.material.line"
    _description = "Point of Sale Material Lines"
    _rec_name = "product_id"

    product_id = fields.Many2one('product.product', string='Product', required=True, change_default=True)
    price = fields.Float(string='Unit Price', digits=0)
    qty = fields.Float('Quantity', digits='Product Unit of Measure', default=1)
    order_line_id = fields.Many2one('pos.order.line', string='Order Line Ref', ondelete='cascade')
    combo_line_id = fields.Many2one('pos.combo.line', string='Combo Line Ref', ondelete='cascade')
    product_uom_id = fields.Many2one('uom.uom', string='Product UoM', related='product_id.uom_id')
    full_product_name = fields.Char('Full Product Name')
    max = fields.Float('Max Quantity', digits='Product Unit of Measure')
    bom = fields.Boolean(string="Default BOM")
    is_replaced = fields.Boolean(string="Is Default BOM")
    replaced_product_id = fields.Many2one('product.product', string='Replaced Product')
    replaceable = fields.Boolean(string='Is replaceable')
    replaceable_ids = fields.Char('Replaceable product Ids')


class PosComboLine(models.Model):
    _name = "pos.combo.line"
    _description = "Point of Sale Combo Lines"
    _rec_name = "product_id"

    product_id = fields.Many2one('product.product', string='Product', required=True, change_default=True)
    price = fields.Float(string='Unit Price', digits=0)
    qty = fields.Float('Quantity', digits='Product Unit of Measure', default=1)
    order_line_id = fields.Many2one('pos.order.line', string='Order Line Ref', ondelete='cascade', required=True)
    product_uom_id = fields.Many2one('uom.uom', string='Product UoM', related='product_id.uom_id')
    full_product_name = fields.Char('Full Product Name')
    bom_id = fields.Integer(string='Bom Id')
    categoryName = fields.Char('Category Name')
    categoryId = fields.Integer(string='Category Id')
    replaceable = fields.Boolean(string='Is replaceable')
    replacePrice = fields.Float(string='Replace Price', digits=0)
    customisePrice = fields.Float(string='Customise Price', digits=0)
    require = fields.Boolean(string='Is Require')
    max = fields.Float('Max Quantity', digits='Product Unit of Measure')
    is_replaced = fields.Boolean(string='Is Replaced')
    replaced_product_id = fields.Many2one('product.product', string='Replaced Product')
    material_lines = fields.One2many('pos.material.line', 'combo_line_id', string='Material Lines',
                                     states={'draft': [('readonly', False)]},
                                     readonly=True, copy=True)
    mo_id = fields.Integer(string='Manufacture Order Id', default=False)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
