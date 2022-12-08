# -*- coding: utf-8 -*-

from datetime import datetime, timedelta

import json

from odoo import SUPERUSER_ID, _, api, fields, models
#from odoo.addons.l10n_mx_edi.tools.run_after_commit import run_after_commit
from odoo.exceptions import UserError


class AccountInvoice(models.Model):
    _inherit = 'account.move'

    @api.model
    def cron_call_order_invoice_process(self):
        res = super(AccountInvoice, self).cron_call_order_invoice_process()
        sale_obj = self.env['sale.order']
        sale_obj.cron_invoice_all()
        return res