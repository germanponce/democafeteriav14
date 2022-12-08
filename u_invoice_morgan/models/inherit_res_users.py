# -*- coding: utf-8 -*-

from datetime import datetime, timedelta
from odoo import SUPERUSER_ID, _, api, fields, models


class ResUsers(models.Model):
    _inherit = 'res.users'

    can_see_all_registries = fields.Boolean(
        'Can see all registries'
    )