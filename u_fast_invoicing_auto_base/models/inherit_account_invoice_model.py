# -*- coding: utf-8 -*-

from datetime import datetime, timedelta

import json

from odoo import SUPERUSER_ID, _, api, fields, models
#from odoo.addons.l10n_mx_edi.tools.run_after_commit import run_after_commit
from odoo.exceptions import UserError


class AccountInvoice(models.Model):
    _inherit = 'account.move'

    auto_payment_policy = fields.Char(
        size=3
    )
    auto_invoice_vat = fields.Char()
    auto_invoice_partner = fields.Char()
    from_auto_invoice = fields.Boolean()

    @api.model
    def cron_call_order_invoice_process(self):
        if not self.env.user.company_id.fi_generic_vat_number:
            raise UserError(_('There is no a generic vat number defined for massive invoicing!'))
        # sale_obj = self.env['sale.order']
        # sale_obj.cron_invoice_all()
        return True

    def fast_invoicing_auto_pay(self):
        self.ensure_one()
        if not self.l10n_mx_edi_cfdi_uuid:
            return False
        if self.env.context.get('fast_invoicing_apply_payment', False):
            so_ids = self.mapped('invoice_line_ids.sale_line_ids.order_id').ids
            # MAKING PAYMENTS
            if self.invoice_has_outstanding:
                outstanding_credits_debits = json.loads(
                    self.invoice_outstanding_credits_debits_widget)
                lines = sorted(outstanding_credits_debits['content'],
                               key=lambda ml: ml['amount'], reverse=True)
                for line in lines:
                    payment = self.env['account.move.line'].browse(line['id']).payment_id
                    if payment.reserved_order_id and payment.reserved_order_id.id not in so_ids:
                        continue
                    try:
                        self.with_context(
                            default_type='entry').js_assign_outstanding_line(line['id'])
                        if self.invoice_payment_state == 'paid':
                            break
                    except Exception as e:
                        self.message_post(body=str(e))
                        raise UserError(str(e))
        return True

    def js_assign_outstanding_line(self, line_id):
        line = self.env['account.move.line'].browse(line_id)
        sale_order_ids = self.mapped('invoice_line_ids.sale_line_ids.order_id').ids
        payment = line.payment_id
        if payment.reserved_order_id and payment.reserved_order_id.id not in sale_order_ids:
            raise UserError(
                _('This payment is reserved for SO %s') % payment.reserved_order_id.name)
        return super().js_assign_outstanding_line(line_id)