# -*- coding: utf-8 -*-

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    fi_generic_vat_number = fields.Char(
        string="Default Invoicing VAT",
        related='company_id.fi_generic_vat_number',
        readonly=False
    )
    fi_res_partner = fields.Many2one(
        'res.partner',
        'Default partner',
        related='company_id.fi_res_partner',
        readonly=False
    )