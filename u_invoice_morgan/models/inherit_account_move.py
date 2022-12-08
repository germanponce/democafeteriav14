# -*- coding: utf-8 -*-

from datetime import datetime, timedelta
from odoo import SUPERUSER_ID, _, api, fields, models


class AccountEdiFormat(models.Model):
    _inherit = 'account.edi.format'

    def _is_required_for_invoice(self, invoice):
        self.ensure_one()
        if invoice.is_morgan_invoice:
            return False
        else:
            return super()._is_required_for_invoice(invoice)


class AccountInvoice(models.Model):
    _inherit = 'account.move'

    is_morgan_invoice = fields.Boolean(
        'Is Training Invoice'
    )
    is_morgan_invoice_its_lines = fields.Boolean(
        'Is Training Invoice',
        compute='compute_is_morgan'
    )

    def compute_is_morgan(self):
        for move in self:
            if move.line_ids:
                if any(line.is_morgan_invoice for line in move.line_ids) or move.is_morgan_invoice:
                    move.is_morgan_invoice_its_lines = True
                else:
                    move.is_morgan_invoice_its_lines = False
            else:
                if move.is_morgan_invoice:
                    move.is_morgan_invoice_its_lines = True
                else:
                    move.is_morgan_invoice_its_lines = False

    @api.depends('edi_document_ids')
    def _compute_cfdi_values(self):
        """
        Heredamos para evitar que se timbren las facturas de Morgan
        """
        for inv in self:
            if inv.is_morgan_invoice:
                inv.l10n_mx_edi_cfdi_uuid = None
                inv.l10n_mx_edi_cfdi_supplier_rfc = None
                inv.l10n_mx_edi_cfdi_customer_rfc = None
                inv.l10n_mx_edi_cfdi_amount = None
            else:
                return super(AccountInvoice, inv)._compute_cfdi_values()

    @api.depends('posted_before', 'state', 'journal_id', 'date')
    def _compute_name(self):
        super(AccountInvoice, self)._compute_name()
        for move in self:
            if move.is_morgan_invoice and move.move_type != 'entry':
                if move.state != 'draft':
                    sequence_id = self.env.ref('u_invoice_morgan.sequence_morgan_seq')
                    move.name = sequence_id.next_by_id()

    def _l10n_mx_edi_retry(self):
        for move in self:
            if move.is_morgan_invoice or move.is_morgan_invoice_its_lines:
                return False
            else:
                return super(AccountInvoice, move)._l10n_mx_edi_retry()


class AccountMoveLine(models.Model):
    _inherit = 'account.move.line'

    is_morgan_invoice = fields.Boolean(
        'Is Training Invoice',
        compute='compute_is_morgan',
        store=True
    )
    is_visible = fields.Boolean(
    )

    @api.depends('payment_id', 'move_id')
    def compute_is_morgan(self):
        for line in self:
            if (line.payment_id and line.payment_id.is_morgan_invoice) or line.move_id.is_morgan_invoice:
                line.is_morgan_invoice = True
            else:
                line.is_morgan_invoice = False

    def _query_get(self, domain=None):
        """
        Evitando que se tengan en cuentas las lineas de factura que son
        de Morgan
        """
        if self.env.context.get('training_data', False):
            return super(AccountMoveLine, self)._query_get(domain=domain)
        else:
            morgan_moves = self._get_morgan_move_line()
            if domain is None:
                domain = []
            domain.append(('id', 'not in', morgan_moves.ids))
            return super(AccountMoveLine, self)._query_get(domain=domain)

    @api.model
    def _get_morgan_move_line(self):
        return self.env['account.move.line'].search(
            ['|', ('is_morgan_invoice', '=', True),
             ('move_id.is_morgan_invoice', '=', True)])

