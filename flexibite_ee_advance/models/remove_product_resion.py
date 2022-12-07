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
from odoo import fields, models


class RemoveProductReason(models.Model):
    _name = 'remove.product.reason'
    _description = "Remove Product Reason"

    name = fields.Char('Name')
    description = fields.Boolean('Description')


class OrderLineCancelReason(models.Model):
    _name = 'order.line.cancel.reason'
    _description = "Order Line Cancel Reason"

    product_id = fields.Many2one('product.product', string='Product')
    pos_order_id = fields.Many2one('pos.order', string='Order Line')
    reason = fields.Many2one('remove.product.reason', string='Reason')
    description = fields.Text(string='description')
# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
