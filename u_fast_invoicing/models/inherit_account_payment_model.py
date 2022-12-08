# -*- coding: utf-8 -*-

import logging

from odoo import _, api, fields, models
from odoo.tools import float_is_zero

_logger = logging.getLogger('[ LINK INVOICE ]')


class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'

    l10n_mx_edi_payment_method_id = fields.Many2one(
        comodel_name='l10n_mx_edi.payment.method',
        string='Payment Way'
    )


class AccountPayment(models.Model):
    _inherit = 'account.payment'

    reserved_order_id = fields.Many2one(
        comodel_name='sale.order',
        string='Sale order',
        readonly=True,
        states={'draft': [('readonly', False)]},
        help='Technical field used to reserve a payment to sale order.'
    )

    @api.onchange('reserved_order_id')
    def _onchange_reserved_order(self):
        for payment in self:
            if not payment.reserved_order_id:
                continue
            self.amount = payment.reserved_order_id.amount_total

    @api.model
    def get_outstanding_credits(self, invoice, partner):
        pay_term_line_ids = invoice.line_ids.filtered(
            lambda am: am.account_id.user_type_id.type in ('receivable', 'payable'))

        domain = [
            ('account_id', 'in', pay_term_line_ids.mapped('account_id').ids),
            '|',
            ('move_id.state', '=', 'posted'),
            '&',
            ('move_id.state', '=', 'draft'),
            ('journal_id.post_at', '=', 'bank_rec'),
            ('partner_id', '=', partner.id),
            ('reconciled', '=', False),
            '|',
            ('amount_residual', '!=', 0.0),
            ('amount_residual_currency', '!=', 0.0),
            ('credit', '=', 0),
            ('debit', '>', 0)
        ]
        lines = self.env['account.move.line'].search(domain)
        line_ids = []
        if len(lines) != 0:
            for line in lines:
                # get the outstanding residual value in invoice currency
                if line.currency_id and line.currency_id == invoice.currency_id:
                    amount_to_show = abs(line.amount_residual_currency)
                else:
                    currency = line.company_id.currency_id
                    amount_to_show = currency._convert(
                        abs(line.amount_residual), invoice.currency_id, invoice.company_id,
                        line.date or fields.Date.today())
                if float_is_zero(amount_to_show, precision_rounding=invoice.currency_id.rounding):
                    continue
                line_ids.append(line.id)
        return line_ids

    def _l10n_mx_edi_create_cfdi_values(self):
        self.ensure_one()
        values = super(AccountPayment, self)._l10n_mx_edi_create_cfdi_values()
        custom_vat = False
        from_auto_invoice = self.env.context.get('from_auto_invoice', False)
        for invoice in self.invoice_ids:
            if from_auto_invoice:
                if custom_vat and invoice.partner_id.vat != custom_vat:
                    self.message_post(
                        _('There are more than one auto invoices with different VAT number.'))
                    break
                custom_vat = invoice.partner_id.vat
            else:
                if not invoice.auto_invoice_vat:
                    continue
                if custom_vat and invoice.auto_invoice_vat != custom_vat:
                    self.message_post(
                        _('There are more than one auto invoices with different VAT number.'))
                    break
                custom_vat = invoice.auto_invoice_vat
        values['auto_invoice_vat'] = custom_vat
        return values

    def post(self):
        payment_invoices = self.mapped('invoice_ids').ids
        for payment in self:
            if payment.payment_type != 'inbound' or payment.partner_type != 'customer':
                continue
            if payment.invoice_ids:
                continue
            if payment.reserved_order_id:
                invoice_ids = self.reserved_order_id.invoice_ids.ids
            else:
                invoices = self.env['account.move'].search([
                    ('partner_id', '=', payment.partner_id.id),
                    ('state', '=', 'posted'),
                    ('type', '=', 'out_invoice'),
                    ('invoice_payment_state', '!=', 'paid'),
                    ('id', 'not in', payment_invoices)
                ])
                invoices |= self.env['sale.order'].search([
                    ('invoice_status', '=', 'invoiced'),
                    ('partner_id', '=', payment.partner_id.id)
                ]).mapped('invoice_ids').filtered(
                    lambda
                        x: x.state == 'posted' and x.type == 'out_invoice' and x.invoice_payment_state != 'paid' and x.id not in payment_invoices)
                invoices = invoices.sorted(lambda x: (x.invoice_date, x.id))
                amount = payment.amount
                invoice_ids = []
                for inv in invoices:
                    if amount <= 0:
                        break
                    if inv.amount_total <= 0:
                        continue
                    inv.l10n_mx_edi_update_pac_status()
                    invoice_ids.append(inv.id)
                    amount -= inv.amount_total
                    payment.message_post(body=_('Invoice {} added to payment.').format(inv.name))
                    _logger.info('Invoice id: {} added to payment'.format(inv.id))
            payment.with_context(deny_sync_invoice=True).write({
                'invoice_ids': [(6, 0, invoice_ids)]
            })
        return super(AccountPayment, self).post()
