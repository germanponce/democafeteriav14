# -*- coding: utf-8 -*-

from datetime import datetime, timedelta
from odoo import SUPERUSER_ID, _, api, fields, models


class AccountReport(models.AbstractModel):
    _inherit = 'account.report'

    filter_training_data = None

    def _set_context(self, options):
        ctx = super()._set_context(options)
        if options.get('training_data'):
            ctx['training_data'] = True
        return ctx

    @api.model
    def _get_options_domain(self, options):
        """
        Vamos a modificar directamente el dominio que generan y
        añadimos el nuestro
        """
        domain = super(AccountReport, self)._get_options_domain(options=options)
        if not options.get('training_data', False):
            move_line_ids = self.env['account.move.line']._get_morgan_move_line()
            domain += [
                ('id', 'not in', move_line_ids.ids)
            ]
        return domain


class AccountChartOfAccountReport(models.AbstractModel):
    _inherit = "account.coa.report"

    filter_training_data = False


class ReportGeneralLedger(models.AbstractModel):
    _inherit = "account.general.ledger"

    filter_training_data = False

    # @api.model
    # def _get_options_domain(self, options):
    #     """
    #     Vamos a modificar directamente el dominio que generan y
    #     añadimos el nuestro
    #     """
    #     domain = super(ReportGeneralLedger, self)._get_options_domain(options=options)
    #     if options.get('training_data'):
    #         move_line_ids = self.env['account.move.line']._get_morgan_move_line()
    #         domain += [
    #             ('id', 'not in', move_line_ids.ids)
    #         ]
    #     return domain


class ReportAccountFinancialReport(models.Model):
    _inherit = "account.financial.html.report"

    filter_training_data = False


class AccountFinancialReportLine(models.Model):
    _inherit = "account.financial.html.report.line"