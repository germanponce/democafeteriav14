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

    def _get_order_by_ref(self, search):
        '''Busca la orden de venta en PoS orders, si existe, genera un token de acceso.
           Si no existe, busca la orden en ventas y genera un token de acceso.
           Retorna diccionario con token, busqueda y si es venta de PoS'''
           
        #TODO  Investigar porque no imprime 
        order = request.env['pos.order'].with_user(SUPERUSER_ID).search([
            ('invoicing_ref', '=', search),
        ], limit=1)
        is_pos = bool(order)
        if order:
            order.generate_access_token()
        if not order:
            order = request.env['sale.order'].with_user(SUPERUSER_ID).search([
                ('invoicing_ref', '=', search),
            ], limit=1)
            order.write({'access_token': str(uuid.uuid4())})
        return {
            'access_token': order.access_token,
            'search': search,
            'is_pos': is_pos,
        }
    #Renderiza la vista de autofactura
    @http.route('/autofactura', auth='public', website=True)
    def index(self,message=False, **kw):  
        return request.render('u_fast_invoicing.invoicing_header', {
            'message': message
         })
        
    #Busqueda de orden con valor por defecto vacio 
    @http.route('/autofactura/search', auth='public', website=True, type='json')
    def search_order(self, search=''):
        return self._get_order_by_ref(search)
    
    #Renderiza mensaje de orden no encontrada
    @http.route('/autofactura/search/not_found', auth='public', website=True, method='get')
    def render_no_search(self, search_query):
        return request.render('u_fast_invoicing.dismissible_alert', {
            'search': search_query,
        })
        
    #Renderiza mensaje con orden vacia
    @http.route('/autofactura/search/not_found/null', auth='public', website=True, method='get')
    def render_search_null(self):
        return request.render('u_fast_invoicing.dismissible_alert_null', {})
    
    #Busca  el token de acceso previamente asignado y crea la URL 
    #Si existe la orden y el token de acceso
    #Retorna la orden, busqueda vacia, etc
    @http.route('/autofactura/pedido/tpv/<string:access_token>', auth='public', website=True)
    def pos_order_index(self, access_token, **kwargs):
        order = request.env['pos.order'].with_user(SUPERUSER_ID).search([
            ('access_token', '=', access_token)], limit=1)
        go_url = '#'
        inv = order.account_move
        if inv and inv.access_token:
            go_url = '/autofactura/' + inv.access_token + '/' + order.access_token + '?tpv=1'
        return request.render('u_fast_invoicing.invoicing_order_page', {
            'order': order,
            'search': '',
            'is_pos': True,
            'cfdi': self.get_cfdi_usage(),
            'invoice': inv,
            'go_url': go_url
        })

    
#Busca el token de acceso asignado a la orden y obtiene los datos del cliente
    @http.route('/autofactura/invoicing/pos/<string:access_token>', auth='public', website=True)
    def invoicing_pos_index(self, access_token, **post):
        order = request.env['pos.order'].with_user(SUPERUSER_ID).search([
            ('access_token', '=', access_token)
        ], limit=1)
        partner = order.partner_id

        p_rfc = partner.vat
        vats = []
        if p_rfc:
            vats = [(p_rfc, p_rfc)] + [(partner.vat, partner.vat)]
        return request.render('u_fast_invoicing.invoicing_invoicing_modal', {
            'order': order,
            'partner': order.partner_id,
            'tpv': 1,
            'cfdi_use': post.get('cfdi_use'),
            'cfdi': self.get_cfdi_usage(),
            'vats': vats
        })
#Obtiene el tipo de CFDI
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
#Facturación con cliente registrado
    @http.route('/autofactura/<string:access_token>/direct', auth='public', website=True)
    def direct_invoicing(self, access_token, **post):
        # BROWSE ORDER
        tpv = bool(post.get('tpv', 0))
        env_obj = tpv and 'pos.order' or 'sale.order'
        sale_order = request.env[env_obj].with_user(SUPERUSER_ID).search([
            ('access_token', '=', access_token)
        ], limit=1)
        partner = sale_order.partner_id

        if not partner:
            return '/autofactura?message=no-partner'

        if not partner.vat:
            return ''

        if tpv:
            # MAKE INVOICE
            try:
                invoices = sale_order.with_context(
                    from_auto_invoice=True).action_pos_order_invoice().get('res_id', False)
                invoices = request.env['account.move'].with_user(SUPERUSER_ID).browse(invoices)
            except UserError as ue:
                request.env.cr.rollback()
                params = {
                    'token': access_token,
                    'message': ue.name or ue.value
                }
                return '/autofactura/error/notify?' + werkzeug.urls.url_encode(params)
        else:
            # MAKE INVOICE
            try:
                invoices = sale_order.with_context(from_auto_invoice=True)._create_invoices()
            except UserError as ue:
                request.env.cr.rollback()
                params = {
                    'token': access_token,
                    'message': ue.name or ue.value
                }
                return '/autofactura/error/notify?' + werkzeug.urls.url_encode(params)

        for inv in invoices.sorted('move_type'):
            payment_method = False
            # POST A MESSAGE
            inv.message_post(body=_('This invoice has been created by user {}').format(
                inv.partner_id.display_name))
            if inv.move_type == 'out_invoice':
                auto_payment_policy = 'PPD'
                payment_obj = request.env['account.payment']
                payments = payment_obj.with_user(SUPERUSER_ID).search([
                    ('partner_id', '=', partner.id),
                    ('payment_type', '=', 'inbound'),
                    ('partner_type', '=', 'customer'),
                    ('state', '=', 'posted')
                ])
                move_lines = payments.mapped('move_line_ids').filtered(
                    lambda ml: not ml.reconciled and ml.credit > 0.0).sorted(
                    lambda ml: ml.get_amount_to_show(inv), reverse=True)
                if move_lines:
                    payment_method = move_lines[:1].payment_id.l10n_mx_edi_payment_method_id.id
                    if sum([ml.get_amount_to_show(inv) for ml in move_lines]) >= inv.amount_total:
                        auto_payment_policy = 'PUE'
                write_data = {
                    'access_token': str(uuid.uuid4()),
                    'l10n_mx_edi_usage': post.get('cfdi_use', False),
                    'auto_payment_policy': auto_payment_policy,
                    'l10n_mx_edi_payment_method_id': payment_method
                }
                if payment_method:
                    write_data['l10n_mx_edi_payment_method_id'] = payment_method
                inv.write(write_data)
            # CONFIRM INVOICE
            confirm_context = dict(
                disable_after_commit=True,
                force_company=request.env.user.company_id.id,
                pos_picking_id=tpv and sale_order.picking_id or False
            )
            try:
                inv.with_context(**confirm_context).post()
            except Exception as e:
                request.env.cr.rollback()
                params = {
                    'token': access_token,
                    'message': str(e)
                }
                return request.redirect(
                    '/autofactura/error/notify?' + werkzeug.urls.url_encode(params))
            # MAKING PAYMENTS
            try:
                inv.with_context(fast_invoicing_apply_payment=True).fast_invoicing_auto_pay()
            except Exception as e:
                request.env.cr.rollback()
                params = {
                    'token': access_token,
                    'message': str(e)
                }
                return '/autofactura/error/notify?' + werkzeug.urls.url_encode(params)
            # SEND MAIL AUTOMATIC
            if inv.move_type == 'out_invoice':
                self._action_send_email(inv.access_token)
                url = '/autofactura/' + inv.access_token + '/' + sale_order.access_token
                params = {}
                if tpv:
                    params['tpv'] = 1
                if params:
                    url += '?%s' % werkzeug.urls.url_encode(params)
                return url
        return '/autofactura?message=no-invoice'



    #Controlador para creación de nuevo usuario
    @http.route('/autofactura/<string:access_token>/submit', auth='public', website=True)
    def invoicing_submit(self, access_token, **post):

        # BROWSE ORDER
        tpv = bool(post.get('tpv', 0))
        env_obj = tpv and 'pos.order' or 'sale.order'
        sale_order = request.env[env_obj].with_user(SUPERUSER_ID).search([
            ('access_token', '=', access_token)
        ], limit=1)
        
        
        if not sale_order.partner_id:
            # Comentamos el comportamiento anterior, ya no usaremos un
            # partner por defecto, creamos un nuevo partner con los datos
            # que nos mandan
            if post.get('vat', False):
                partner_id = request.env['res.partner'].with_user(SUPERUSER_ID).\
                    search([('vat', 'ilike', post['vat'])], limit=1)
                if partner_id:
                    sale_order.partner_id = partner_id.id
                else:
                    new_partner_id = request.env['res.partner'].with_user(SUPERUSER_ID).create({
                        'vat': post.get('vat', False),
                        'name': post.get('name', False),
                        'phone': post.get('phone', False),
                        'email': post.get('email', False),
                    })
                    sale_order.partner_id = new_partner_id.id
        else:
            sale_order.partner_id.write({
                'vat': post.get('vat', False) or sale_order.partner_id.vat,
                'name': post.get('name', False) or sale_order.partner_id.name,
                'phone': post.get('phone', False) or sale_order.partner_id.phone,
                'email': post.get('email', False) or sale_order.partner_id.email,
            })
        if tpv:
            # MAKE INVOICE
            try:
                invoices = sale_order.with_context(
                    from_auto_invoice=True).action_pos_order_invoice().get('res_id', False)
                invoices = request.env['account.move'].with_user(SUPERUSER_ID).browse(invoices)

            except UserError as ue:
                request.env.cr.rollback()
                params = {
                    'token': access_token,
                    'message': ue.name or ue.value
                }
                return request.redirect(
                    '/autofactura/error/notify?' + werkzeug.urls.url_encode(params))
        else:
            # MAKE INVOICE

            try:
                invoices = sale_order.with_context(from_auto_invoice=True)._create_invoices()
            except UserError as ue:
                request.env.cr.rollback()
                params = {
                    'token': access_token,
                    'message': ue.name or ue.value
                }
                return request.redirect('/autofactura/error/notify?' + werkzeug.urls.url_encode(params))

        for inv in invoices.sorted(lambda x: x.move_type, reverse=True):
            payment_method = False
            # POST A MESSAGE
            inv.message_post(body=_('This invoice has been created by user {}').format(
                inv.partner_id.display_name))
            if inv.move_type == 'out_invoice':
                auto_payment_policy = 'PPD'
                payment_obj = request.env['account.payment']
                payments = payment_obj.with_user(SUPERUSER_ID).search([
                    ('partner_id', '=', sale_order.partner_id.id),
                    ('payment_type', '=', 'inbound'),
                    ('partner_type', '=', 'customer'),
                    ('state', '=', 'posted')
                ])
                move_lines = payments.mapped('line_ids').filtered(
                    lambda ml: not ml.reconciled and ml.credit > 0.0).sorted(
                    lambda ml: ml.get_amount_to_show(inv), reverse=True)
                if move_lines:
                    payment_method = move_lines[:1].payment_id.l10n_mx_edi_payment_method_id.id
                    if sum([ml.get_amount_to_show(inv) for ml in move_lines]) >= inv.amount_total:
                        auto_payment_policy = 'PUE'
                write_data = {
                    'access_token': str(uuid.uuid4()),
                    'l10n_mx_edi_usage': post.get('cfdi_use', False),
                    'auto_payment_policy': auto_payment_policy,
                    'auto_invoice_vat': post.get('vat', False),
                    'l10n_mx_edi_payment_method_id': 'Efectivo'
                }
                if payment_method:
                    write_data['l10n_mx_edi_payment_method_id'] = payment_method
                else:
                    if tpv:
                        # Hemos hecho que coincida las formas de pagos de la localizacion
                        # con los diarios, antes solo mapeaba banco, ahora las mapeamos todas
                        # asi en caso de que la orden venga del tpv y con pagos podemos halar esa forma
                        # desde ahi
                        pos_payment_line = sale_order.payment_ids[:1]
                        payment_method = pos_payment_line.payment_method_id.l10n_mx_edi_payment_method_id.id
                        write_data['l10n_mx_edi_payment_method_id'] = payment_method

                inv.write(write_data)
            # CONFIRM INVOICE
            confirm_context = dict(
                disable_after_commit=True,
                with_company=request.env.user.company_id.id,
                pos_picking_id=tpv and sale_order.picking_ids or False
            )
            # Añadimos esta validacion pq ya la funcion
            # _create_invoices trata de postear la factura, nosotros
            # solo lo hacemos si no viene posteada
            if inv.state != 'posted':
                try:
                    inv.with_context(**confirm_context).post()
                except Exception as e:
                    request.env.cr.rollback()
                    params = {
                        'token': access_token,
                        'message': str(e)
                    }
                    return request.redirect('/autofactura/error/notify?' + werkzeug.urls.url_encode(params))
            # MAKING PAYMENTS
            try:
                inv.with_context(fast_invoicing_apply_payment=True).fast_invoicing_auto_pay()
            except Exception as e:
                request.env.cr.rollback()
                params = {
                    'token': access_token,
                    'message': str(e)
                }
                return request.redirect('/autofactura/error/notify?' + werkzeug.urls.url_encode(params))
            if inv.move_type == 'out_invoice':
                # SEND MAIL AUTOMATIC
                self._action_send_email(inv.access_token)
                url = '/autofactura/' + inv.access_token + '/' + sale_order.access_token
                params = {}
                if tpv:
                    params['tpv'] = 1
                if params:
                    url += '?%s' % werkzeug.urls.url_encode(params)
                return request.redirect(url)
        return request.redirect('/autofactura?message=no-invoice')

    @http.route('/autofactura/<string:invoice_token>/<string:order_token>',
                auth='public', website=True)
    def invoice_index(self, invoice_token, order_token, tpv=0, **kwargs):
        try:
            invoice_sudo = request.env['account.move'].with_user(SUPERUSER_ID).search([
                ('access_token', '=', invoice_token)
            ], limit=1)
        except (AccessError, MissingError):
            return request.redirect('/autofactura?message=no-token')
        if bool(tpv):
            order_sudo = request.env['pos.order'].with_user(SUPERUSER_ID).search([
                ('access_token', '=', order_token)
            ], limit=1)
        else:
            order_sudo = request.env['sale.order'].with_user(SUPERUSER_ID).search([
                ('access_token', '=', order_token)
            ], limit=1)

        if not invoice_sudo or not order_sudo:
            return request.redirect('/autofactura?message=no-token')

        return request.render('u_fast_invoicing.invoice_view', {
            'invoice': invoice_sudo,
            'order': order_sudo,
            'tpv': bool(tpv),
            'message': kwargs.get('message', '')
        })

    @http.route('/autofactura/send/<string:access_token>', auth='public', website=True)
    def send_invoice(self, access_token):
        send_message = self._action_send_email(access_token=access_token)
        if not send_message:
            return request.redirect('/autofactura?message=no-token')
        return request.redirect('/autofactura?message=' + send_message)

    def _action_send_email(self, access_token):
        inv_obj = request.env['account.move'].with_user(SUPERUSER_ID)
        invoice = inv_obj.search([
            ('access_token', '=', access_token),
        ], limit=1)
        if not invoice:
            return False
        # MAKE MANUAL INVOICE SEND
        send = False
        template = request.env.ref(
            'account.email_template_edi_invoice', False).with_user(SUPERUSER_ID)
        rendering_context = dict(request.env.context)
        template = template and template.with_context(rendering_context)
        lang = request.env.context.get('lang')
        if template and template.lang:
            #lang = template._render_lang([ctx['default_res_id']])[ctx['default_res_id']]
            lang = template._render_template(template.lang, 'account.move', [invoice.id])

        invoice = invoice.with_context(lang=lang)

        if invoice.partner_id.email and template:
            mail_id = template.send_mail(invoice.id, force_send=True)
            send = bool(mail_id)

        return send and 'send-ok' or 'send-failed'

    @http.route('/autofactura/autocomplete', auth='public', website=True, type='json')
    def autocomplete_data(self, vat):
        res = {}
        partner_id = request.env['res.partner'].with_user(SUPERUSER_ID).\
            search([('vat', 'ilike', vat)], limit=1)
        if partner_id:
            res = {
                'partner': True,
                'name': partner_id.name,
                'phone': partner_id.phone,
                'email': partner_id.email
            }
        else:
            res = {
                'partner': False,
                'name': '',
                'phone': '',
                'email': ''
            }
        return res

    @http.route('/autofactura/vat/validation', auth='public', website=True, type='json')
    def vat_validation(self, vat, country_id):
        # vat validation
        res = {}
        if not vat:
            return res
        partner_obj = request.env['res.partner']
        if vat and hasattr(partner_obj, "check_vat"):
            partner_dummy = partner_obj.with_user(SUPERUSER_ID).new({
                'vat': vat,
                'name': _('Generic'),
                'country_id': (int(country_id) if country_id else False),
            })
            try:
                partner_dummy.check_vat()
            except ValidationError as ve:
                res['error'] = ve.name or ve.value
        if not res.get('error'):
            try:
                validate(vat, validate_check_digits=True)
            except InvalidLength:
                res['error'] = _('The number has an invalid length.')
            except InvalidChecksum:
                res['error'] = _('The number"s checksum or check digit is invalid.')
            except InvalidComponent:
                res['error'] = _('One of the parts of the number are invalid or unknown.')
            except InvalidFormat:
                res['error'] = _('The number has an invalid format.')
        res['vat'] = format(vat, '')
        return res


