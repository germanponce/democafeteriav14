# -*- coding: utf-8 -*-

from odoo import SUPERUSER_ID, _, api, fields, models
from odoo.exceptions import UserError


class AccountPayment(models.Model):
    _name = 'account.payment.manual'
    _description = 'Technical module to separate payments.'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = 'partner_id'

    partner_id = fields.Many2one(
        comodel_name='res.partner',
        string='Partner',
        tracking=True,
        readonly=True,
        states={
            'draft': [('readonly', False)]
        },
        domain="['|', ('company_id', '=', False), ('company_id', '=', company_id)]"
    )
    amount = fields.Monetary(
        string='Amount',
        required=True,
        readonly=True,
        states={
            'draft': [('readonly', False)]
        },
        tracking=True
    )
    currency_id = fields.Many2one(
        comodel_name='res.currency',
        string='Currency',
        required=True,
        readonly=True,
        states={
            'draft': [('readonly', False)]
        },
        default=lambda self: self.env.company.currency_id
    )
    payment_date = fields.Date(
        string='Date',
        default=fields.Date.context_today,
        required=True,
        readonly=True,
        states={'draft': [('readonly', False)]},
        copy=False,
        tracking=True
    )
    communication = fields.Char(
        string='Memo',
        readonly=True,
        states={
            'draft': [('readonly', False)]
        }
    )
    journal_id = fields.Many2one(
        comodel_name='account.journal',
        string='Journal',
        required=True,
        readonly=True,
        states={
            'draft': [('readonly', False)]
        },
        tracking=True,
        domain="[('type', 'in', ('bank', 'cash')), ('company_id', '=', company_id)]"
    )
    company_id = fields.Many2one(
        comodel_name='res.company',
        default=lambda x: x.env.user.company_id,
        string='Company',
        readonly=True
    )
    state = fields.Selection(
        selection=[
            ('draft', 'Draft'),
            ('posted', 'Validated'),
            ('cancelled', 'Cancelled')
        ],
        readonly=True,
        default='draft',
        copy=False,
        string="Status"
    )
    order_ids = fields.Many2many(
        comodel_name='sale.order',
        relation='account_payment_manual_sale_rel',
        column1='payment_id',
        column2='order_id',
        string='Orders'
    )
    invoice_ids = fields.Many2many(
        comodel_name='account.move',
        relation='account_payment_manual_invoice_rel',
        column1='payment_id',
        column2='invoice_id',
        string='Invoices'
    )
    payment_ids = fields.Many2many(
        comodel_name='account.payment',
        relation='account_payment_manual_payment_rel',
        column1='manual_id',
        column2='payment_id',
        string='Payments'
    )
    order_count = fields.Integer(
        compute='_compute_counts'
    )
    invoice_count = fields.Integer(
        compute='_compute_counts'
    )
    payment_count = fields.Integer(
        compute='_compute_counts'
    )
    l10n_mx_edi_payment_method_id = fields.Many2one(
        comodel_name='l10n_mx_edi.payment.method',
        string='Payment Way',
        readonly=True,
        states={
            'draft': [('readonly', False)]
        },
        help='Indicates the way the payment was/will be received, where the '
             'options could be: Cash, Nominal Check, Credit Card, etc.'
    )

    @api.depends('order_ids', 'invoice_ids', 'payment_ids')
    def _compute_counts(self):
        for record in self:
            record.order_count = len(record.order_ids)
            record.invoice_count = len(record.invoice_ids)
            record.payment_count = len(record.payment_ids)

    def action_confirm(self):
        self.ensure_one()
        if self.amount <= 0:
            raise UserError(_('Please set a positive amount.'))
        sale_obj = self.env['sale.order']
        payment_obj = self.env['account.payment']
        # SEARCH FOR ALL SALE ORDERS WITH OPEN INVOICES
        orders = sale_obj.search([
            ('partner_id', '=', self.partner_id.id),
            ('state', 'in', ('sale', 'done')),
            ('invoice_status', '=', 'invoiced')
        ])
        order_ids = []
        invoices = self.env['account.move']
        payments = self.env['account.payment']
        amount = self.amount
        payment_method_id = self.env['account.payment.method'].with_user(SUPERUSER_ID).search([
            ('code', '=', 'manual'),
            ('payment_type', '=', 'inbound'),
        ], limit=1).id,
        for order in orders:
            if amount <= 0:
                break
            inv = order.invoice_ids.filtered(
                lambda x: x.state == 'posted' and x.type == 'out_invoice' and x.invoice_payment_state != 'paid')[:1]
            if not inv:
                continue
            invoices |= inv
            order_ids.append(order.id)
            payments |= payment_obj.create({
                'payment_type': 'inbound',
                'partner_type': 'customer',
                'partner_id': self.partner_id.id,
                'amount': order.amount_total <= amount and order.amount_total or amount,
                'journal_id': self.journal_id.id,
                'payment_date': self.payment_date,
                'communication': self.communication,
                'invoice_ids': [(6, 0, inv.ids)],
                'payment_method_id': payment_method_id,
                'l10n_mx_edi_payment_method_id': self.l10n_mx_edi_payment_method_id.id
            })
            amount -= order.amount_total
        if amount > 0:
            payments |= payment_obj.create({
                'payment_type': 'inbound',
                'partner_type': 'customer',
                'partner_id': self.partner_id.id,
                'amount': amount,
                'journal_id': self.journal_id.id,
                'payment_date': self.payment_date,
                'communication': self.communication,
                'payment_method_id': payment_method_id,
                'l10n_mx_edi_payment_method_id': self.l10n_mx_edi_payment_method_id.id
            })
        payments.post()
        self.write({
            'invoice_ids': [(6, 0, invoices.ids)],
            'order_ids': [(6, 0, order_ids)],
            'payment_ids': [(6, 0, payments.ids)],
            'state': 'posted'
        })
        return True

    def action_view_sales_orders(self):
        self.ensure_one()
        action = {
            'name': _('Sales Order(s)'),
            'type': 'ir.actions.act_window',
            'res_model': 'sale.order',
            'target': 'current',
        }
        sale_order_ids = self.order_ids.ids
        if len(sale_order_ids) == 1:
            action['res_id'] = sale_order_ids[0]
            action['view_mode'] = 'form'
        else:
            action['view_mode'] = 'tree,form'
            action['domain'] = [('id', 'in', sale_order_ids)]
        return action

    def action_view_sales_payments(self):
        self.ensure_one()
        action = {
            'name': _('Payment(s)'),
            'type': 'ir.actions.act_window',
            'res_model': 'account.payment',
            'target': 'current',
        }
        payment_ids = self.payment_ids.ids
        if len(payment_ids) == 1:
            action['res_id'] = payment_ids[0]
            action['view_mode'] = 'form'
        else:
            action['view_mode'] = 'tree,form'
            action['domain'] = [('id', 'in', payment_ids)]
        return action

    def action_view_sales_invoices(self):
        self.ensure_one()
        action = {
            'name': _('Invoice(s)'),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
            'target': 'current',
        }
        invoice_ids = self.invoice_ids.ids
        if len(invoice_ids) == 1:
            action['res_id'] = invoice_ids[0]
            action['view_mode'] = 'form'
        else:
            action['view_mode'] = 'tree,form'
            action['domain'] = [('id', 'in', invoice_ids)]
        return action




