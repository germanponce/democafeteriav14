# -*- coding: utf-8 -*-
import json
import logging
import random
import string
import uuid

from odoo import SUPERUSER_ID, _, api, fields, models
from odoo.exceptions import UserError

from werkzeug import urls


class PosOrder(models.Model):
    _inherit = 'pos.order'

    access_token = fields.Char(
        default=lambda s: str(uuid.uuid4()))
    invoicing_ref = fields.Char(
        size=10)

    def _init_column(self, column_name):
        """ Based on website_calendar module:
        See: /website_calendar/models/calendar_event.py:18
        """
        if column_name != 'access_token':
            super(PosOrder, self)._init_column(column_name)

    def generate_access_token(self):
        """
        Generate access token for all events with out one.
        :return:
        """
        for record in self.filtered(lambda x: not x.access_token):
            record.with_user(SUPERUSER_ID).write({'access_token': str(uuid.uuid4())})

    def get_invoicing_url(self):
        """

        :return:
        """
        self.ensure_one()
        base_url = self.env['ir.config_parameter'].with_user(SUPERUSER_ID).get_param(
            'web.base.url')
        return urls.url_join(base_url, "/autofactura")

    @api.model
    def invoicing_ref_to_ui(self):
        """
        :return:
        """
        reference = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
        return {
            'invoicing_ref': reference,
            'invoicing_url': self.get_invoicing_url()
        }

    @api.model
    def get_invoicing_ref(self):
        """
        Generate invoicing ref unique code.
        :return:
        """
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))

    def generate_invoicing_ref(self):
        """
        TODO:
        :return:
        """
        self.ensure_one()
        if self.invoicing_ref:
            return False
        return self.write({'invoicing_ref': self.get_invoicing_ref()})

    @api.model
    def _order_fields(self, ui_order):
        res = super(PosOrder, self)._order_fields(ui_order)
        res['invoicing_ref'] = ui_order.get('invoicing_ref', False)
        return res

    def _prepare_invoice_vals(self):
        vals = super(PosOrder, self)._prepare_invoice_vals()
        if self.env.context.get('allow_use_generic_vat', False):
            vals['auto_invoice_vat'] = self.env.context['allow_use_generic_vat']
        if self.env.context.get('allow_use_generic_partner', False):
            vals['auto_invoice_partner'] = self.env.context['allow_use_generic_partner']
        return vals

class PosConfig(models.Model):
    _inherit = 'pos.config'

    domain = fields.Char(
        #TODO: esto revisarlo
        #related='journal_id.analytic_account_id.website_id.domain',
        store=True
    )
