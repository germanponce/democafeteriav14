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

from odoo import models, fields, api


class PosConfig(models.Model):
    _inherit = 'pos.config'

    enable_combo = fields.Boolean('Enable Combo')
    edit_combo = fields.Boolean('Single Click for Edit Combo')
    hide_uom = fields.Boolean('Hide UOM')


class ProductTemplate(models.Model):
    _inherit = "product.template"

    is_combo = fields.Boolean("Is Combo")
    product_combo_ids = fields.One2many('product.combo', 'product_tmpl_id')
    is_packaging = fields.Boolean("Is Packaging")


class ProductCombo(models.Model):
    _name = 'product.combo'
    _description = 'Product Combo'

    product_tmpl_id = fields.Many2one('product.template')
    require = fields.Boolean("Required", help="Don't select it if you want to make it optional")
    pos_category_id = fields.Many2one('pos.category', "Categories")
    display_name = fields.Char('Display Name')
    product_ids = fields.Many2many('product.product', string="Products")
    no_of_items = fields.Integer("No. of Items", default=1)
    replaceable = fields.Boolean("Replaceable", help="Select it if you want to make it replaceable")
    base_price = fields.Integer("Base Price", default=0)


class ProductProduct(models.Model):
    _inherit = "product.product"

    @api.model
    def name_search(self, name, args=None, operator='ilike', limit=100):
        args = args or []
        if self._context.get('is_required', False):
            args += [['available_in_pos', '=', True]]
        if self._context.get('category_from_line', False):
            pos_category_id = self.env['pos.category'].browse(self._context.get('category_from_line'))
            args += [['pos_categ_id', 'child_of', pos_category_id.id], ['available_in_pos', '=', True]]
        return super(ProductProduct, self).name_search(name, args=args, operator='ilike', limit=100)

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
