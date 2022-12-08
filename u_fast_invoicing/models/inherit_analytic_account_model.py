# -*- coding: utf-8 -*-

from odoo import fields, models


class AccountAnalyticAccount(models.Model):
    _inherit = 'account.analytic.account'

    website_id = fields.Many2one(
        comodel_name='website',
        string='Website'
    )
