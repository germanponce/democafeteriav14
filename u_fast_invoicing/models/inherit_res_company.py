# -*- coding: utf-8 -*-

from odoo import fields, models


class ResCompany(models.Model):
    _inherit = 'res.company'

    fi_notification_channel_ids = fields.Many2many(
        comodel_name='mail.channel',
        relation='website_channel_fast_invoicing_rel',
        column1='website_id',
        column2='channel_id',
        string='Notification channels'
    )
    # fi_res_partner = fields.Many2one(
    #     'res.partner',
    #     'Default partner'
    # )
