# -*- coding: utf-8 -*-

from datetime import datetime, timedelta
from odoo import SUPERUSER_ID, _, api, fields, models
from odoo.tools import float_is_zero, float_compare
from odoo.exceptions import UserError


class SaleOrder(models.Model):
    _inherit = 'sale.order'

    def _prepare_invoice(self):
        res = super(SaleOrder, self)._prepare_invoice()
        if self.env.context.get('is_morgan', False):
            res['is_morgan_invoice'] = True
        return res

    def _create_invoices(self, grouped=False, final=False):
        invoice_vals_list = []
        morgan_invoice_vals_list = []
        precision = self.env['decimal.precision'].precision_get('Product Unit of Measure')

        for order in self:
            if order.partner_id.morgan_percent:
                # Si la factura es para un partner que sea
                # 100% training lo sacamos en una variable para impedir
                # que mas adelante se haga la factura normal
                is_100_percent_morgan = order.partner_id.morgan_percent == 100

                # Si la factura tiene un partner que tiene porciento de
                # Morgan es necesario crear dos facturas una Morgan con
                # el % indicado en la ficha y la otra normal con la diferencia del porcentaje.
                pending_section = None
                morgan_invoice_vals = order.with_context(is_morgan=True)._prepare_invoice()
                invoice_vals = order._prepare_invoice()

                for line in order.order_line:
                    if line.display_type == 'line_section':
                        pending_section = line
                        continue
                    if float_is_zero(line.qty_to_invoice, precision_digits=precision):
                        continue
                    if line.qty_to_invoice > 0 or (line.qty_to_invoice < 0 and final):
                        if pending_section:
                            invoice_vals['invoice_line_ids'].append(
                                (0, 0, pending_section._prepare_invoice_line()))
                            pending_section = None
                        morgan_invoice_vals['invoice_line_ids'].append(
                            (0, 0, line.with_context(from_morgan=True,morgan_share=True).
                             _prepare_invoice_line()))

                        # Solo creamos la factura normal
                        # si no es 100 % morgan
                        if not is_100_percent_morgan:
                            invoice_vals['invoice_line_ids'].append(
                                (0, 0, line.with_context(from_morgan=True, morgan_share=False).
                                 _prepare_invoice_line()))

                if not invoice_vals['invoice_line_ids'] and not morgan_invoice_vals['invoice_line_ids']:
                    raise UserError(_(
                        'There is no invoiceable line. If a product has a Delivered '
                        'quantities invoicing policy, please make sure that a quantity '
                        'has been delivered.'))

                moves = self.env['account.move'].sudo().with_context(default_type='out_invoice')
                # Solo la creamos si no es 100 % morgan
                if not is_100_percent_morgan:
                    invoice_vals_list.append(invoice_vals)
                    moves = self.env['account.move'].sudo().with_context(default_type='out_invoice').create(
                        invoice_vals_list)

                morgan_invoice_vals_list.append(morgan_invoice_vals)
                morgan_moves = self.env['account.move'].sudo().with_context(default_type='out_invoice').create(
                    morgan_invoice_vals_list)

                moves |= morgan_moves

                if final:
                    moves.sudo().filtered(lambda m: m.amount_total < 0).\
                        action_switch_invoice_into_refund_credit_note()
                for move in moves:
                    move.message_post_with_view('mail.message_origin_link',
                                                values={'self': move,
                                                        'origin': move.line_ids.mapped('sale_line_ids.order_id')},
                                                subtype_id=self.env.ref('mail.mt_note').id
                                                )
                return moves
            else:
                return super(SaleOrder, self)._create_invoices(grouped=grouped, final=final)


class SaleOrderLine(models.Model):
    _inherit = 'sale.order.line'

    def _prepare_invoice_line(self, **optional_values):
        res = super(SaleOrderLine, self)._prepare_invoice_line(**optional_values)

        if self.env.context.get('from_morgan', False):
            if self.env.context.get('morgan_share', False):
                original_qty = res['price_unit']
                morgan_percent = self.order_id.partner_id.morgan_percent
                value = original_qty * morgan_percent / 100
                # Actualizamos con el nuevo valor
                res['price_unit'] = value
                res['is_morgan_invoice'] = True
            else:
                original_qty = res['price_unit']
                morgan_percent = self.order_id.partner_id.morgan_percent
                value = original_qty - (original_qty * morgan_percent / 100)
                # Actualizamos con el nuevo valor
                res['price_unit'] = value
        return res
