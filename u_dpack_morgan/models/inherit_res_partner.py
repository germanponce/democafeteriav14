# -*- coding: utf-8 -*-

from datetime import datetime, timedelta
from odoo import SUPERUSER_ID, _, api, fields, models


class ResPartner(models.Model):
    _inherit = 'res.partner'

    morgan_percent = fields.Float(
        'Training Percent'
    )
