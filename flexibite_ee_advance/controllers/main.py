# -*- coding: utf-8 -*-
#################################################################################
# Author      : Acespritech Solutions Pvt. Ltd. (<www.acespritech.com>)
# Copyright(c): 2012-Present Acespritech Solutions Pvt. Ltd.
# All Rights Reserved.
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#################################################################################

from odoo import http
from odoo.http import request
from odoo.addons.web.controllers.main import Home
from odoo.addons.bus.controllers.main import BusController


class Home(Home):

    def _login_redirect(self, uid, redirect=None):
        user_id = request.env['res.users'].sudo().browse(uid)
        if user_id and user_id.kitchen_screen_user == 'cook' and user_id.default_pos:
            pos_session = request.env['pos.session'].sudo().search(
                [('config_id', '=', user_id.default_pos.id), ('state', '=', 'opening_control')])
            if not pos_session:
                if user_id.default_pos.cash_control:
                    pos_session.write({'opening_balance': True})
                    pos_session.action_pos_session_open()
                session_id = user_id.default_pos.open_session_cb()
            redirect = '/pos/ui?config_id=' + str(user_id.default_pos.id)
        return super(Home, self)._login_redirect(uid, redirect=redirect)


class KitchenScreenController(BusController):

    def _poll(self, dbname, channels, last, options):
        """Add the relevant channels to the BusController polling."""
        channels = list(channels)
        if options.get('pos.order.line'):
            ticket_channel = (
                request.db,
                'pos.order.line',
                options.get('pos.order.line')
            )
            channels.append(ticket_channel)

        return super(KitchenScreenController, self)._poll(dbname, channels, last, options)


class CustomerDisplayController(BusController):
    def _poll(self, dbname, channels, last, options):
        """Add the relevant channels to the BusController polling."""
        if options.get('customer.display'):
            channels = list(channels)
            ticket_channel = (
                request.db,
                'customer.display',
                options.get('customer.display')
            )
            channels.append(ticket_channel)

        return super(CustomerDisplayController, self)._poll(dbname, channels, last, options)


class PosMirrorController(http.Controller):

    @http.route(['/web/customer_display', '/web/customer_display/<int:id>'], type='http', auth='user')
    def white_board_web(self, **k):
        config_id = False
        pos_sessions = request.env['pos.session'].search([
            ('state', '=', 'opened'),
            ('user_id', '=', request.session.uid),
            ('rescue', '=', False), ('config_id', '=', int(k.get('id')))])
        if pos_sessions:
            config_id = pos_sessions.config_id.id
        session_info = request.env['ir.http'].session_info()
        context = {
            'session_info': session_info,
            'config_id': config_id,
        }
        return request.render('flexibite_ee_advance.index', qcontext=context)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
