# -*- coding: utf-8 -*-

import json
import logging
import random
import string
from psycopg2 import OperationalError

from datetime import timedelta

from odoo import SUPERUSER_ID, _, api, fields, models
from odoo.exceptions import UserError

from werkzeug import urls

_logger = logging.getLogger('[ AUTO FACTURA ]')


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    invoicing_ref = fields.Char()
    service_effective_date = fields.Datetime(
        compute='_compute_service_effective_date',
        store=True
    )

    @api.depends('order_line', 'order_line.product_id', 'date_order')
    def _compute_service_effective_date(self):
        for record in self:
            if any(line.product_id.type != 'service' for line in record.order_line):
                record.service_effective_date = False
            else:
                record.service_effective_date = record.date_order

    def generate_invoicing_ref(self):
        """
        Generate invoicing ref unique code.
        :return:
        """
        self.ensure_one()
        if self.invoicing_ref:
            return False
        reference = ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))
        return self.write({'invoicing_ref': reference})

    @api.model
    def create(self, vals_list):
        order = super(SaleOrder, self).create(vals_list)
        order.with_user(SUPERUSER_ID).generate_invoicing_ref()
        return order

    def write(self, vals):
        res = super(SaleOrder, self).write(vals)
        if 'invoicing_ref' not in vals:
            for order in self:
                order.generate_invoicing_ref()
        return res

    def get_invoicing_url(self):
        self.ensure_one()
        base_url = self.get_base_url()
        return urls.url_join(base_url, "/autofactura")

    def _prepare_invoice(self):
        self.ensure_one()
        res = super(SaleOrder, self)._prepare_invoice()
        if self.env.context.get('allow_use_generic_vat', False):
            res['auto_invoice_vat'] = self.env.context['allow_use_generic_vat']
        if self.env.context.get('allow_use_generic_partner', False):
            res['auto_invoice_partner'] = self.env.context['allow_use_generic_partner']
        res['from_auto_invoice'] = self.env.context.get('from_auto_invoice', False)
        return res

    def fi_action_send_error(self, error):
        channels = self.env.user.company_id.fi_notification_channel_ids
        message_obj = self.env['mail.message']
        if channels:
            message_obj.create({
                'author_id': self.partner_id.id,
                'model': 'mail.channel',
                'res_id': 0,
                'message_type': 'comment',
                'body': _('Error auto invoicing SO {}. {}').format(self.name, error),
                'channel_ids': [(6, 0, channels.ids)]
            })
        return True
