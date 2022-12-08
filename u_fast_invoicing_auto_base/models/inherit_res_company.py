# -*- coding: utf-8 -*-

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    fi_generic_vat_number = fields.Char(
        string="Default Invoicing VAT"
    )
    fi_res_partner = fields.Many2one(
        'res.partner',
        'Default partner'
    )
