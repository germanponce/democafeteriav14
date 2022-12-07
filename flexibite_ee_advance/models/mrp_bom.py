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

from odoo import models, fields


class ProductMrpBom(models.Model):
    _inherit = 'mrp.bom'

    available_in_pos = fields.Boolean(string='Available in POS')


class ProductMrpBomLine(models.Model):
    _inherit = 'mrp.bom.line'

    replaceable = fields.Boolean(string='Replaceable')
    replaceable_product_ids = fields.Many2many('product.product', string='Replace With')
    available_in_pos = fields.Boolean(related='bom_id.available_in_pos', string='Available in POS')
    bom_base_price = fields.Float(string='Base Price')
    replaceable_by = fields.Selection([('product', 'product'), ('category', 'Category')],
                                      string="Replace By")
    replaceable_category_ids = fields.Many2many('pos.category', string='Replace With')

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
