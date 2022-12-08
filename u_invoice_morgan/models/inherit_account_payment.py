# -*- coding: utf-8 -*-

from datetime import datetime, timedelta
from odoo import SUPERUSER_ID, _, api, fields, models


class AccountPayment(models.AbstractModel):
    _inherit = 'account.payment'

    is_morgan_invoice = fields.Boolean(
        'Is Training Invoice',
        compute='compute_is_morgan',
        store=True
    )

    def _prepare_payment_moves(self):
        res = super(AccountPayment, self)._prepare_payment_moves()
        for payment in self:
            if payment.is_morgan_invoice:
                res[0]['is_morgan_invoice'] = True
        return res

    @api.depends('move_id')
    def compute_is_morgan(self):
        for payment in self:
            active_id = self.env.context.get('active_id')
            active_model = self.env.context.get('active_model')
            if active_model == 'account.move':
                move_id = self.env[active_model].browse(active_id)
                if move_id and move_id.is_morgan_invoice:
                    payment.is_morgan_invoice = True
                else:
                    payment.is_morgan_invoice = False
            else:
                payment.is_morgan_invoice = False

    def l10n_mx_edi_is_required(self):
        self.ensure_one()
        active_id = self.env.context.get('active_id')
        active_model = self.env.context.get('active_model')
        if active_model == 'account.move' and \
                self.env[active_model].browse(active_id).is_morgan_invoice:
            return False
