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
import hashlib

from odoo import models, fields, api


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    rfid_pin = fields.Char("RFID PIN Code")

    def get_barcodes_and_pin_hashed(self):
        if not self.env.user.has_group('point_of_sale.group_pos_user'):
            return []
        # Apply visibility filters (record rules)
        visible_emp_ids = self.search([('id', 'in', self.ids)])
        employees_data = self.sudo().search_read([('id', 'in', visible_emp_ids.ids)], ['barcode', 'pin', 'rfid_pin'])

        for employee in employees_data:
            employee['barcode'] = hashlib.sha1(employee['barcode'].encode('utf8')).hexdigest() if employee[
                'barcode'] else False
            employee['pin'] = hashlib.sha1(employee['pin'].encode('utf8')).hexdigest() if employee['pin'] else False
            employee['rfid_pin'] = hashlib.sha1(employee['rfid_pin'].encode('utf8')).hexdigest() if employee[
                'rfid_pin'] else False
        return employees_data

# vim:expandtab:smartindent:tabstop=4:softtabstop=4:shiftwidth=4:
