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

from odoo import fields, models, api, _


class PosConfig(models.Model):
    _inherit = 'pos.config'

    order_type_ids = fields.Many2many('order.type', string="Order Type")
    default_type_id = fields.Many2one('order.type', string="Default Type")
    delivery_service_ids = fields.Many2many('pos.delivery.service', string="Delivery Services")
    # Wallet field
    enable_wallet = fields.Boolean('Wallet')
    wallet_product = fields.Many2one('product.product', string="Wallet Product")
    wallet_account_id = fields.Many2one("account.account", string="Wallet Account")
    wallet_payment_method_id = fields.Many2one("pos.payment.method", "Wallet Payment Method")
    # Gift Card field
    enable_gift_card = fields.Boolean('Gift Card')
    gift_card_account_id = fields.Many2one('account.account', string="Gift Card Account")
    gift_card_product_id = fields.Many2one('product.product', string="Gift Card Product")
    enable_journal_id = fields.Many2one('pos.payment.method', string="Enable Journal")
    manual_card_number = fields.Boolean('Manual Card No.')
    default_exp_date = fields.Integer('Default Card Expire Months')
    msg_before_card_pay = fields.Boolean('Confirm Message Before Card Payment')
    # Gift voucher field
    enable_gift_voucher = fields.Boolean('Gift Voucher')
    gift_voucher_account_id = fields.Many2one("account.account", string="Account")
    gift_voucher_journal_id = fields.Many2one("pos.payment.method", string="Payment Method")
    # default Customer
    enable_default_customer = fields.Boolean('Default Customer')
    default_customer_id = fields.Many2one('res.partner', string="Select Customer")
    # Money in/out
    money_in_out = fields.Boolean("Money In/Out")
    money_in_out_receipt = fields.Boolean("Money In/Out Receipt")
    # vertical-category
    enable_vertical_category = fields.Boolean('Vertical Product Category')
    # Bag Charges
    enable_bag_charges = fields.Boolean(string="Bag Charges")
    # Lock Screen
    enable_manual_lock = fields.Boolean(string="Manual")
    enable_automatic_lock = fields.Boolean(string="Automatic")
    time_interval = fields.Float(string="Time Interval (Minutes)")
    # POS session close
    enable_close_session = fields.Boolean(string="Enable Close Session")
    z_report_pdf = fields.Boolean(string="Z Report Pdf")
    email_close_session_report = fields.Boolean(string="Email Z Report")
    allow_with_zero_amount = fields.Boolean(string="Allow With 0 Amount")
    email_template_id = fields.Many2one('mail.template', string="Email Template")
    users_ids = fields.Many2many('res.users', string="Users")
    # return_order
    enable_pos_return = fields.Boolean("Order Return from POS")
    # product summary report
    enable_product_summary = fields.Boolean(string="Product Summary Report")
    product_current_month_date = fields.Boolean(string="Product Current Month Date")
    product_summary_signature = fields.Boolean(string="Signature")

    # order summary report
    enable_order_summary = fields.Boolean(string='Order Summary Report')
    order_current_month_date = fields.Boolean(string="Order Current Month Date")
    order_signature = fields.Boolean(string="Order Signature")

    # payment summary report
    enable_payment_summary = fields.Boolean(string="Payment Summary Report")
    payment_current_month_date = fields.Boolean(string="Payment Current Month Date")

    # audit report
    enable_audit_report = fields.Boolean("Print Audit Report")
    # product screen
    enable_product_screen = fields.Boolean("Product Screen")

    # Material Monitor
    enable_material_monitor = fields.Boolean("Material Monitor")
    enable_stock_location = fields.Boolean("Stock Location", compute='show_enable_material_monitor')

    def show_enable_material_monitor(self):
        if self.env.user.has_group('stock.group_stock_multi_locations'):
            self.enable_stock_location = True
        else:
            self.enable_stock_location = False

    @api.constrains('time_interval')
    def _check_time_interval(self):
        if self.enable_automatic_lock and self.time_interval < 0:
            raise Warning(_('Time Interval Not Valid'))

    @api.model
    def search(self, args, offset=0, limit=None, order=None, count=False):
        if self.env.context.get('from_pos'):
            user_id = self.env['res.users'].browse([self.env.context.get('uid')])
            if user_id and user_id.kitchen_screen_user in ['waiter', 'cook']:
                args += [('id', '=', user_id.default_pos.id)]
        return super(PosConfig, self).search(args, offset=offset, limit=limit, order=order, count=count)


class OrderType(models.Model):
    _name = 'order.type'
    _rec_name = 'type'
    _description = "Order Type"

    type = fields.Char('Type')
    color = fields.Char('color')


class PosDeliveryService(models.Model):
    _name = 'pos.delivery.service'
    _description = "POS Delivery Service"

    logo = fields.Binary('Logo')
    name = fields.Char('Name')


class IrActionsReport(models.Model):
    _inherit = 'ir.actions.report'

    @api.model
    def get_html_report(self, receipt_id, report_name):
        report = self._get_report_from_name(report_name)
        document = report._render_qweb_html(receipt_id, data={})
        if document:
            return document
        return False

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
