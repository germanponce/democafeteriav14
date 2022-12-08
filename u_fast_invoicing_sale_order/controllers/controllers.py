# -*- coding: utf-8 -*-
import json
import logging
from stdnum.mx.rfc import format, validate, InvalidComponent, InvalidFormat, InvalidLength, InvalidChecksum
import uuid

from odoo import SUPERUSER_ID, _, http
from odoo.exceptions import AccessError, MissingError, UserError, ValidationError
from odoo.http import request

import werkzeug
import werkzeug.urls

logger = logging.getLogger(__name__)


class FastInvoicing(http.Controller):

    @http.route('/autofactura/error/notify', auth='public', website=True)
    def invoice_notify_error(self, **kwargs):
        sale_order = request.env['sale.order'].with_user(SUPERUSER_ID).search([
            ('access_token', '=', kwargs.get('token', 'n/d'))
        ], limit=1)
        sale_order.fi_action_send_error(kwargs.get('message', ''))
        return request.redirect('/autofactura/error/{}'.format(sale_order.access_token))

    @http.route('/autofactura/error/<string:access_token>', auth='public', website=True)
    def invoice_error(self, access_token, **kwargs):
        sale_order = request.env['sale.order'].with_user(SUPERUSER_ID).search([
            ('access_token', '=', access_token)
        ], limit=1)
        return request.render('u_fast_invoicing.invoice_error', {
            'order': sale_order
        })

    @http.route('/autofactura/search', auth='public', website=True, type='json')
    def search_order(self, search=''):
        # TODO: Domain more complex
        order = request.env['sale.order'].with_user(SUPERUSER_ID).search([
            ('invoicing_ref', '=', search),
        ], limit=1)
        order.write({'access_token': str(uuid.uuid4())})
        return {
            'access_token': order.access_token,
            'search': search,
            'is_pos': False
        }

    @http.route('/autofactura/pedido/<string:access_token>', auth='public', website=True)
    def order_index(self, access_token, **kwargs):
        order = request.env['sale.order'].with_user(SUPERUSER_ID).search([
            ('access_token', '=', access_token)
        ], limit=1)
        inv = False
        go_url = '#'
        if order.invoice_status == 'invoiced':
            inv = order.invoice_ids.filtered(
                lambda x: x.state != 'cancel' and x.move_type == 'out_invoice')[:1]
            if inv and inv.access_token:
                go_url = '/autofactura/' + inv.access_token + '/' + order.access_token

        return request.render('u_fast_invoicing.invoicing_order_page', {
            'order': order,
            'search': '',
            'go_url': go_url,
            'invoice': inv,
            'is_pos': False,
            'cfdi': self.get_cfdi_usage(),
        })

    @http.route('/autofactura/pedido/search/<string:search>', auth='public', website=True)
    def no_order_index(self, search=False, **kwargs):
        return request.render('u_fast_invoicing.invoicing_order_page', {
            'order': False,
            'search': search,
            'is_pos': False,
            'invoice': False
        })

    @http.route('/autofactura/invoicing/<string:access_token>', auth='public', website=True)
    def invoicing_index(self, access_token, **post):
        order = request.env['sale.order'].with_user(SUPERUSER_ID).search([
            ('access_token', '=', access_token)
        ])
        partner = order.partner_id
        p_rfc = partner.vat
        vats = []
        if p_rfc:
            vats = [(p_rfc, p_rfc)] + [(partner.vat, partner.vat)]
        return request.render('u_fast_invoicing.invoicing_invoicing_modal', {
            'order': order,
            'partner': order.partner_id,
            'tpv': 0,
            'cfdi_use': post.get('cfdi_use'),
            'vats': vats
        })

    def get_cfdi_usage(self):
        return [
            ('G01', _('Acquisition of merchandise')),
            ('G02', _('Returns, discounts or bonuses')),
            ('G03', _('General expenses')),
            ('I01', _('Constructions')),
            ('I02', _('Office furniture and equipment investment')),
            ('I03', _('Transportation equipment')),
            ('I04', _('Computer equipment and accessories')),
            ('I05', _('Dices, dies, molds, matrices and tooling')),
            ('I06', _('Telephone communications')),
            ('I07', _('Satellite communications')),
            ('I08', _('Other machinery and equipment')),
            ('D01', _('Medical, dental and hospital expenses.')),
            ('D02', _('Medical expenses for disability')),
            ('D03', _('Funeral expenses')),
            ('D04', _('Donations')),
            ('D05', _('Real interest effectively paid for mortgage loans (room house)')),
            ('D06', _('Voluntary contributions to SAR')),
            ('D07', _('Medical insurance premiums')),
            ('D08', _('Mandatory School Transportation Expenses')),
            ('D09', _('Deposits in savings accounts, premiums based on pension plans.')),
            ('D10', _('Payments for educational services (Colegiatura)')),
            ('P01', _('To define')),
        ]



    @http.route('/autofactura/message/post', auth='public', website=True, type='json')
    def fi_message_post(self, order_id, message):
        sale_order = request.env['sale.order'].with_user(SUPERUSER_ID).search([
            ('access_token', '=', order_id)
        ], limit=1)
        if sale_order:
            body = _('<p>Message from auto invoice by {}</p>').format(sale_order.partner_id.name)
            if message:
                body += message
            sale_order.message_post(body=body)
        return True

