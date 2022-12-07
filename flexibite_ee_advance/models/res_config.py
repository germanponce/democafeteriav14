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
from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # birthday reminder
    enable_birthday_reminder = fields.Boolean(string="Birthday Reminder")
    birthday_template_id = fields.Many2one('mail.template', string="Birthday Mail Template")
    # Anniversary reminder
    enable_anniversary_reminder = fields.Boolean(string="Anniversary Reminder")
    anniversary_template_id = fields.Many2one('mail.template', string="Anniversary Template")
    # generate Barcode
    gen_barcode = fields.Boolean("On Product Create Generate Barcode")
    barcode_selection = fields.Selection([('code_39', 'CODE 39'), ('code_128', 'CODE 128'),
                                          ('ean_13', 'EAN-13'), ('ean_8', 'EAN-8'),
                                          ('isbn_13', 'ISBN 13'), ('isbn_10', 'ISBN 10'),
                                          ('issn', 'ISSN'), ('upca', 'UPC-A')], string="Select Barcode Type")
    gen_internal_ref = fields.Boolean(string="On Product Create Generate Internal Reference")

    last_token_number = fields.Char(string="Last Token Number")
    restaurant_mode = fields.Selection([('full_service', 'Full Service Restaurant (FCS)'),
                                        ('quick_service', 'Fast-Food/Quick Service Restaurant (QSR)')],
                                       string="Restaurant Mode", default="full_service")
    generate_token = fields.Boolean(string="Generate Token")
    separate_receipt = fields.Boolean(string="Separate Receipt")

    @api.model
    def load_settings(self):
        record = {}
        last_token_number = self.env['ir.config_parameter'].sudo().search([('key', '=', 'last_token_number')])
        restaurant_mode = self.env['ir.config_parameter'].sudo().search([('key', '=', 'restaurant_mode')])
        generate_token = self.env['ir.config_parameter'].sudo().search([('key', '=', 'generate_token')])
        separate_receipt = self.env['ir.config_parameter'].sudo().search([('key', '=', 'separate_receipt')])
        if last_token_number:
            record['last_token_number'] = last_token_number.value
        if restaurant_mode:
            record['restaurant_mode'] = restaurant_mode.value
        if generate_token:
            record['generate_token'] = generate_token.value
        if separate_receipt:
            record['separate_receipt'] = separate_receipt.value
        return [record]

    @api.model
    def get_values(self):
        res = super(ResConfigSettings, self).get_values()
        param_obj = self.env['ir.config_parameter'].sudo()
        res.update({
            'enable_birthday_reminder': param_obj.get_param('flexibite_ee_advance.enable_birthday_reminder'),
            'birthday_template_id': int(param_obj.get_param('flexibite_ee_advance.birthday_template_id')),
            'enable_anniversary_reminder': param_obj.get_param('flexibite_ee_advance.enable_anniversary_reminder'),
            'anniversary_template_id': int(param_obj.get_param('flexibite_ee_advance.anniversary_template_id')),

            'gen_barcode': param_obj.get_param('gen_barcode'),
            'barcode_selection': param_obj.get_param('barcode_selection'),
            'gen_internal_ref': param_obj.get_param('gen_internal_ref'),
            'last_token_number': param_obj.get_param('last_token_number'),
            'restaurant_mode': param_obj.get_param('restaurant_mode'),
            'generate_token': param_obj.get_param('generate_token'),
            'separate_receipt': param_obj.get_param('separate_receipt'),
        })
        return res

    def set_values(self):
        param_obj = self.env['ir.config_parameter'].sudo()
        param_obj.set_param('flexibite_ee_advance.enable_birthday_reminder', self.enable_birthday_reminder)
        param_obj.set_param('flexibite_ee_advance.birthday_template_id', self.birthday_template_id.id)
        param_obj.set_param('flexibite_ee_advance.enable_anniversary_reminder', self.enable_anniversary_reminder)
        param_obj.set_param('flexibite_ee_advance.anniversary_template_id', self.anniversary_template_id.id)

        param_obj.set_param('gen_barcode', self.gen_barcode)
        param_obj.set_param('barcode_selection', self.barcode_selection)
        param_obj.set_param('gen_internal_ref', self.gen_internal_ref)
        param_obj.set_param('last_token_number', self.last_token_number or '0')
        param_obj.set_param('generate_token', self.generate_token or False)
        param_obj.set_param('restaurant_mode', self.restaurant_mode or 'full_service')
        param_obj.set_param('separate_receipt', self.separate_receipt or False)

        return super(ResConfigSettings, self).set_values()

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
