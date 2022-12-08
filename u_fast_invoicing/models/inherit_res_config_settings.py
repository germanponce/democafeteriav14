# -*- coding: utf-8 -*-

from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    fi_notification_channel_ids = fields.Many2many(
        related='company_id.fi_notification_channel_ids',
        readonly=False
    )
    # fi_res_partner = fields.Many2one(
    #     'res.partner',
    #     'Default partner',
    #     related='company_id.fi_res_partner',
    #     readonly=False
    # )
