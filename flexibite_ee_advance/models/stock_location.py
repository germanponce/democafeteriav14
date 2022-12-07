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

import pytz
from odoo import models, fields, api
from pytz import timezone
from datetime import datetime, date


class StockLocation(models.Model):
    _inherit = 'stock.location'

    def get_current_date_x(self):
        if self.env.user.tz:
            tz = timezone(self.env.user.tz)
        else:
            tz = pytz.utc
        if tz:
            c_time = datetime.now(tz)
            return c_time.strftime('%d/%m/%Y')
        else:
            return date.today().strftime('%d/%m/%Y')

    def get_current_time_x(self):
        if self.env.user.tz:
            tz = timezone(self.env.user.tz)
        else:
            tz = pytz.utc
        if tz:
            c_time = datetime.now(tz)
            return c_time.strftime('%I:%M %p')
        else:
            return datetime.now().strftime('%I:%M:%S %p')

    def get_inventory_details(self):
        product_product = self.env['product.product']
        pos_session = self.env['pos.session'].search([])
        inventory_records = []
        final_list = []
        product_details = []
        for line in pos_session.mapped('picking_ids').filtered(
                lambda picking: picking.location_id.id == self.id).mapped('move_line_ids'):
            product_details.append({
                'id': line.product_id.id,
                'qty': line.qty_done,
            })
        custom_list = []
        for each_prod in product_details:
            if each_prod.get('id') not in [list_custom.get('id') for list_custom in custom_list]:
                custom_list.append(each_prod)
            else:
                for each in custom_list:
                    if each.get('id') == each_prod.get('id'):
                        each.update({'qty': each.get('qty') + each_prod.get('qty')})
        if custom_list:
            for each in custom_list:
                product_id = product_product.browse(each.get('id'))
                inventory_records.append({
                    'product_id': [product_id.id, product_id.name],
                    'category_id': [product_id.id, product_id.categ_id.name],
                    'used_qty': each.get('qty'),
                    'quantity': product_id.with_context({'location': self.id, 'compute_child': False}).qty_available,
                    'uom_name': product_id.uom_id.name or ''
                })
            if inventory_records:
                temp_list = []
                temp_obj = []
                for each in inventory_records:
                    if each.get('product_id')[0] not in temp_list:
                        temp_list.append(each.get('product_id')[0])
                        temp_obj.append(each)
                    else:
                        for rec in temp_obj:
                            if rec.get('product_id')[0] == each.get('product_id')[0]:
                                qty = rec.get('quantity') + each.get('quantity');
                                rec.update({'quantity': qty})
                final_list = sorted(temp_obj, key=lambda qty: qty['quantity'])

        return final_list or []

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
