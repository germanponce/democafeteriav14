# -*- coding: utf-8 -*-

from datetime import datetime, timedelta
from odoo import SUPERUSER_ID, _, api, fields, models
from odoo.tools import float_is_zero, float_compare
from odoo.exceptions import UserError
from itertools import groupby


class PurchaseOrder(models.Model):
    _inherit = 'purchase.order'

    def particular_get_computed_account(self, move_id, product_id):
        fiscal_position = move_id.fiscal_position_id
        product_id = self.env['product.product'].browse(int(product_id))

        accounts = product_id.product_tmpl_id.get_product_accounts(fiscal_pos=fiscal_position)
        return accounts['expense']

    def _prepare_invoice(self):
        res = super(PurchaseOrder, self)._prepare_invoice()
        if self.env.context.get('is_morgan', False):
            res['is_morgan_invoice'] = True
        return res

    def action_create_invoice(self):
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')

        invoice_vals_list = []
        morgan_invoice_vals_list = []

        for order in self:
            if not order.partner_id.morgan_percent:
                return super(PurchaseOrder, self).action_create_invoice()

            if order.invoice_status != 'to invoice':
                continue

            order = order.with_company(order.company_id)
            pending_section = None

            # Si la factura es para un partner que sea
            # 100% training lo sacamos en una variable para impedir
            # que mas adelante se haga la factura normal
            is_100_percent_morgan = order.partner_id.morgan_percent == 100

            morgan_invoice_vals = order.with_context(is_morgan=True)._prepare_invoice()
            invoice_vals = order._prepare_invoice()

            for line in order.order_line:
                if line.display_type == 'line_section':
                    pending_section = line
                    continue
                if not float_is_zero(line.qty_to_invoice, precision_digits=precision):
                    if pending_section:
                        invoice_vals['invoice_line_ids'].append(
                            (0, 0, pending_section._prepare_account_move_line()))
                        pending_section = None

                    morgan_invoice_vals['invoice_line_ids'].append(
                        (0, 0, line.with_context(from_morgan=True, morgan_share=True).
                         _prepare_account_move_line()))

                    if not is_100_percent_morgan:
                        invoice_vals['invoice_line_ids'].append(
                            (0, 0, line.with_context(from_morgan=False, morgan_share=False).
                             _prepare_account_move_line()))

            if not is_100_percent_morgan:
                invoice_vals_list.append(invoice_vals)

            morgan_invoice_vals_list.append(morgan_invoice_vals)

        if not invoice_vals_list and not morgan_invoice_vals_list:
            raise UserError(_('There is no invoiceable line. If a product has a '
                              'control policy based on received quantity, please make '
                              'sure that a quantity has been received.'))

        new_invoice_vals_list = []
        morgan_new_invoice_vals_list = []

        if not is_100_percent_morgan:
            for grouping_keys, invoices in groupby(invoice_vals_list, key=lambda x: (x.get('company_id'),
                                                                                     x.get('partner_id'),
                                                                                     x.get('currency_id'))):
                origins = set()
                payment_refs = set()
                refs = set()
                ref_invoice_vals = None
                for invoice_vals in invoices:
                    if not ref_invoice_vals:
                        ref_invoice_vals = invoice_vals
                    else:
                        ref_invoice_vals['invoice_line_ids'] += invoice_vals['invoice_line_ids']
                    origins.add(invoice_vals['invoice_origin'])
                    payment_refs.add(invoice_vals['payment_reference'])
                    refs.add(invoice_vals['ref'])
                ref_invoice_vals.update({
                    'ref': ', '.join(refs)[:2000],
                    'invoice_origin': ', '.join(origins),
                    'payment_reference': len(payment_refs) == 1 and payment_refs.pop() or False,
                })
                new_invoice_vals_list.append(ref_invoice_vals)

            invoice_vals_list = new_invoice_vals_list

        for grouping_keys, invoices in groupby(morgan_invoice_vals_list, key=lambda x: (x.get('company_id'),
                                                                                   x.get('partner_id'),
                                                                                   x.get('currency_id'))):
            origins = set()
            payment_refs = set()
            refs = set()
            ref_invoice_vals = None
            for invoice_vals in invoices:
                if not ref_invoice_vals:
                    ref_invoice_vals = invoice_vals
                else:
                    ref_invoice_vals['invoice_line_ids'] += invoice_vals['invoice_line_ids']
                origins.add(invoice_vals['invoice_origin'])
                payment_refs.add(invoice_vals['payment_reference'])
                refs.add(invoice_vals['ref'])
            ref_invoice_vals.update({
                'ref': ', '.join(refs)[:2000],
                'invoice_origin': ', '.join(origins),
                'payment_reference': len(payment_refs) == 1 and payment_refs.pop() or False,
            })
            morgan_new_invoice_vals_list.append(ref_invoice_vals)

        morgan_invoice_vals_list = morgan_new_invoice_vals_list

        # 3) Create invoices.
        moves = self.env['account.move']
        AccountMove = self.env['account.move'].with_context(default_move_type='in_invoice')

        if not is_100_percent_morgan:
            for vals in invoice_vals_list:
                moves |= AccountMove.with_company(vals['company_id']).create(vals)

        for mvals in morgan_invoice_vals_list:
            moves |= AccountMove.with_company(mvals['company_id']).create(mvals)

        moves.filtered(lambda m: m.currency_id.round(m.amount_total) < 0).action_switch_invoice_into_refund_credit_note()

        return self.action_view_invoice(moves)


class PurchaseOrderLine(models.Model):
    _inherit = 'purchase.order.line'

    def _prepare_account_move_line(self, move=False):
        self.ensure_one()
        res = super(PurchaseOrderLine, self)._prepare_account_move_line(move)
        if self.env.context.get('from_morgan', False):
            original_qty = res['price_unit']
            morgan_percent = self.order_id.partner_id.morgan_percent
            value = original_qty * morgan_percent / 100

            # Actualizamos con el nuevo valor
            res['price_unit'] = value
            res['quantity'] = self.product_qty
            res['is_morgan_invoice'] = True
            res['currency_id'] = False
        else:
            original_qty = res['price_unit']
            morgan_percent = self.order_id.partner_id.morgan_percent
            value = original_qty - (original_qty * morgan_percent / 100)

            # Actualizamos con el nuevo valor
            res['price_unit'] = value
            res['currency_id'] = False

        return res

