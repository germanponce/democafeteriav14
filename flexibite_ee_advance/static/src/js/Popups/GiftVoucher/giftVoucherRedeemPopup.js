odoo.define('flexibite_ee_advance.giftVoucherRedeemPopup', function(require) {
    'use strict';

    const { useState, useRef } = owl.hooks;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');
    var rpc = require('web.rpc');
    var core = require('web.core');
    var _t = core._t;

    class giftVoucherRedeemPopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            this.state = useState({ GiftVoucherNumber: '', GiftVoucherAmount:0.0});
            this.gift_voucher_number_ref = useRef('gift_voucher_number');
            this.gift_voucher_amount_ref = useRef('gift_voucher_amount');
        }
        confirm(){
            var self = this;
            if (this.state.GiftVoucherNumber) {
                var today = moment().locale('en').format('YYYY-MM-DD');
                var code = this.state.GiftVoucherNumber;
                var order = this.env.pos.get_order();
                var params = {
                    model: 'aspl.gift.voucher',
                    method: 'search_read',
                    domain: [['voucher_code', '=', code]],
                }
                rpc.query(params, {async: false}).then(function(res){
                    if(res.length > 0){
                        if (res[0]){
                            var expiry_date = moment(res[0]['expiry_date']).format('YYYY-MM-DD');
                            var order_total_with_tax = order.get_total_with_tax()
                            if(order.get_rounding_applied() && order.get_rounding_applied() > 0){
                                order_total_with_tax = order_total_with_tax + order.get_rounding_applied()
                            }
                            var order_total_without_tax = order_total_with_tax - order.get_total_tax()
                            if(res[0]['expiry_date'] && today > expiry_date){
                                $('#lbl_set_available').html("Gift Voucher is expired on "+moment(res[0]['expiry_date']).format('DD. MMM. YYYY'));
                            }else if(res[0]['minimum_purchase'] && res[0]['minimum_purchase'] > 0 && order_total_without_tax < res[0]['minimum_purchase']){
                                $('#lbl_set_available').html("Order Amount is "+res[0]['minimum_purchase']+" or more for applying this Voucher");
                            }else if(res[0]['redemption_order'] > 0 && res[0]['redemption_order'] <= res[0]['redeem_voucher_count']){
                                $('#lbl_set_available').html("Your limit of use voucher is expired!");
                            }else{
                                self.state.GiftVoucherAmount = Number(res[0]['voucher_amount'])
                                self.props.resolve({
                                    confirmed: true, 
                                    payload: {
                                        card_amount: self.state.GiftVoucherAmount,
                                        card_no: self.state.GiftVoucherNumber,
                                        voucher_id: res[0]['id']
                                    }
                                });
                            }
                        }
                    }else{
                        $('#lbl_set_available').html("Invalid Gift Voucher code");
                    }
                });
            
            }
        }
        CheckGiftvoucher(e) {
            self = this;
            if (e.which == 13 && this.state.GiftVoucherNumber) {
                var today = moment().locale('en').format('YYYY-MM-DD');
                var code = this.state.GiftVoucherNumber;
                var order = this.env.pos.get_order();
                var params = {
                    model: 'aspl.gift.voucher',
                    method: 'search_read',
                    domain: [['voucher_code', '=', code]],
                }
                rpc.query(params, {async: false}).then(function(res){
                    if(res.length > 0){
                        if (res[0]){
                            var expiry_date = moment(res[0]['expiry_date']).format('YYYY-MM-DD');
                            var order_total_with_tax = order.get_total_with_tax()
                            if(order.get_rounding_applied() && order.get_rounding_applied() > 0){
                                order_total_with_tax = order_total_with_tax + order.get_rounding_applied()
                            }
                            var order_total_without_tax = order_total_without_tax = order_total_with_tax - order.get_total_tax()
                            if(res[0]['expiry_date'] && today > expiry_date){
                                $('#lbl_set_available').html("Gift Voucher is expired on "+moment(res[0]['expiry_date']).format('DD. MMM. YYYY'));
                            }else if(res[0]['minimum_purchase'] && res[0]['minimum_purchase'] > 0 &&order_total_without_tax < res[0]['minimum_purchase']){
                                $('#lbl_set_available').html("Order Amount is "+res[0]['minimum_purchase']+" or more for applying this Voucher");
                            }else if(res[0]['redemption_order'] > 0 && res[0]['redemption_order'] <= res[0]['redeem_voucher_count']){
                                $('#lbl_set_available').html("Your limit of use voucher is expired!");
                            }else{
                                $('#lbl_set_available').html("Gift Voucher Amount is "+res[0]['voucher_amount']);
                            }
                        }
                    }else{
                        $('#lbl_set_available').html("Invalid Gift Voucher code");
                    }
                });
            }
        }
        check_redemption_customer(voucher_id){
            var self = this;
            var order = self.env.pos.get_order();
            var domain = [['voucher_id', '=', voucher_id]];
            if(order.get_client()){
                domain.push(['customer_id', '=', order.get_client().id])
            }
            var params = {
                model: 'aspl.gift.voucher.redeem',
                method: 'search_count',
                args: [domain],
            }
            return rpc.query(params, {async: false})
        }
        cancel() {
            this.trigger('close-popup');
        }
    }
    giftVoucherRedeemPopup.template = 'giftVoucherRedeemPopup';
    giftVoucherRedeemPopup.defaultProps = {
        confirmText: 'Apply',
        cancelText: 'Cancel',
        title: '',
        body: '',
    };

    Registries.Component.add(giftVoucherRedeemPopup);

    return giftVoucherRedeemPopup;
});
