# -*- coding: utf-8 -*-

import json
import logging

from odoo import SUPERUSER_ID, _, api, fields, models
from odoo.exceptions import ValidationError
from datetime import date

_logger = logging.getLogger('[ AUTO FACTURA ]')


class PosOrder(models.Model):
    _inherit = 'pos.order'

    is_refund = fields.Boolean(
        'Is refund'
    )

    def _prepare_refund_values(self, current_session):
        res = super(PosOrder, self)._prepare_refund_values(current_session)
        res['is_refund'] = True
        return res

    def action_pos_order_invoice(self):
        for order in self:
            if not order.partner_id:
                auto_partner = self.env.company.fi_res_partner
                if not auto_partner:
                    raise ValidationError('Error. If pos orders can be defined without partners, '
                                          'you must define a generic partner for auto invoice process')
                else:
                    order.partner_id = auto_partner.id
        return super(PosOrder, self).action_pos_order_invoice()

    @api.model
    def cron_invoice_all(self):
        orders = self.search([
            ('invoice_group', '=', True),
            ('state', 'in', ('paid', 'done')),
            ('account_move', '=', False),
            ('is_refund', '!=', True)
        ], order='date_order desc')
        if not orders:
            return False
        ctx = dict(
            allow_use_generic_vat=self.env.user.company_id.fi_generic_vat_number,
            allow_use_generic_partner=self.env.user.company_id.fi_res_partner
        )
        orders.with_context(**ctx).action_pos_order_invoice()
        invoices = orders.mapped('account_move').filtered(lambda x: x.state not in ('cancel'))
        # CONFIRM INVOICE
        confirm_context = dict(
            with_company=self.env.user.company_id.id,
        )
        #invoices.with_context(**confirm_context).action_post()
        # MAKING PAYMENTS
        for inv in invoices:
            # Cambiamos la fecha por la actual
            inv.invoice_date = date.today()
            if not inv.invoice_has_outstanding:
                continue
            outstanding_credits_debits = json.loads(inv.invoice_outstanding_credits_debits_widget)
            lines = outstanding_credits_debits['content']
            for line in lines:
                if inv.state == 'paid':
                    break
                inv.with_context(from_auto_invoice=True,
                                 default_type='entry').js_assign_outstanding_line(line['id'])

            # Añadiendo logica para el metodo de pago
            if inv.move_type == 'out_invoice':
                # Hemos hecho que coincida las formas de pagos de la localizacion
                # con los diarios, antes solo mapeaba banco, ahora las mapeamos todas
                # asi en caso de que la orden venga del tpv y con pagos podemos halar esa forma
                # desde ahi
                for order in orders:
                    pos_payment_line = order.payment_ids[:1]
                    payment_method = pos_payment_line.payment_method_id.l10n_mx_edi_payment_method_id.id
                    inv.l10n_mx_edi_payment_method_id = payment_method

            if not inv.invoice_has_outstanding:
                continue
            outstanding_credits_debits = json.loads(inv.invoice_outstanding_credits_debits_widget)
            lines = outstanding_credits_debits['content']
            for line in lines:
                if inv.state == 'paid':
                    break
                inv.with_context(from_auto_invoice=True,
                                 default_type='entry').js_assign_outstanding_line(line['id'])

        return True
