# -*- coding: utf-8 -*-

import logging
from psycopg2 import OperationalError

from datetime import date

from odoo import SUPERUSER_ID, _, api, fields, models
from odoo.exceptions import UserError

from werkzeug import urls

_logger = logging.getLogger('[ AUTO FACTURA ]')


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    @api.model
    def cron_invoice_all(self):
        orders = self.search([
            ('invoice_status', '=', 'to invoice')])
        if not orders:
            return False
        ctx = dict(
            allow_use_generic_vat=self.env.user.company_id.fi_generic_vat_number,
            allow_use_generic_partner=self.env.user.company_id.fi_res_partner
        )
        moves = self.env['account.move']
        for order in orders:
            try:
                moves |= order.with_context(**ctx)._create_invoices()
            except UserError as error:
                _logger.info(error.name)
                continue
        moves = moves.sorted('move_type').filtered(lambda x: x.state not in ('cancel'))
        batches = [moves[index:index + 50] for index in range(0, len(moves), 50)]
        for invoices in batches:
            try:
                for invoice in invoices:
                    try:
                        # Cambiamos la fecha por la actual
                        invoice.invoice_date = date.today()
                        # CONFIRM INVOICE
                        confirm_context = dict(
                            with_company=self.env.user.company_id.id,
                            disable_after_commit=True
                        )
                        #invoice.with_context(**confirm_context)._post()
                        invoice.with_context(
                            fast_invoicing_apply_payment=True).fast_invoicing_auto_pay()
                        self.env.cr.commit()

                        # Añadiendo logica para el metodo de pago
                        if invoice.move_type == 'out_invoice':
                            payment_obj = self.env['account.payment']
                            payments = payment_obj.with_user(SUPERUSER_ID).search([
                                ('partner_id', '=', invoice.partner_id.id),
                                ('payment_type', '=', 'inbound'),
                                ('partner_type', '=', 'customer'),
                                ('state', '=', 'posted')
                            ])
                            if payments:
                                move_lines = payments.mapped('move_line_ids').filtered(
                                    lambda ml: not ml.reconciled and ml.credit > 0.0).sorted(
                                    lambda ml: ml.get_amount_to_show(invoice), reverse=True)
                                if move_lines:
                                    payment_method = move_lines[:1].payment_id.l10n_mx_edi_payment_method_id.id
                                if payment_method:
                                    invoice.l10n_mx_edi_payment_method_id = payment_method

                    except Exception as e:
                        _logger.info(str(e))
                        self.env.cr.rollback()
                        continue
            except OperationalError:
                _logger.error('A batch of moves could not be published :%s', repr(invoices))
                continue
        return True
