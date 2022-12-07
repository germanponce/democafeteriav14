odoo.define('flexibite_ee_advance.MiddelCustomControlButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const { Gui } = require('point_of_sale.Gui');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');
    const { useRef, useState } = owl.hooks;
    var rpc = require('web.rpc');

    class MiddelCustomControlButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('add_wallet_amount', this.AddWalletAmount);
            useListener('open-gift-card-screen', this.OpenGiftCardScreen);
            useListener('open-gift-voucher-screen', this.OpenGiftVoucherScreen);
            useListener('create-money-in-out', this.CreateMoneyInOut);
            useListener('apply-bag-charges', this.ApplyBagCharges);
            useListener('show-order-return-screen', this.ShowOrderReturnScreen);
            useListener('show-material-monitor', this.ShowMaterialMonitorScreen);
            this.state = useState({'is_packaging_filter': false})
        }
        orderIsEmpty(order) {
            var self = this;
            var currentOrderLines = order.get_orderlines();
            var lines_ids = []
            if(!order.is_empty()) {
                _.each(currentOrderLines,function(item) {
                    lines_ids.push(item.id);
                });
                _.each(lines_ids,function(id) {
                    order.remove_orderline(order.get_orderline(id));
                });
            }
        }
        
        // if Wallet is enable
        async AddWalletAmount(){
            if(this.env.pos.get_order().get_client()){
                const { confirmed,payload } = await this.showPopup('WalletPopup', {
                    title: this.env._t('Add to Wallet'),
                    customer: this.env.pos.get_order().get_client().name,
                });
                if (confirmed) {
                    if(this.env.pos.get_order().get_orderlines().length > 0){
                        const { confirmed } = await this.showPopup('ConfirmPopup', {
                            title: this.env._t('would you like to discard this order?'),
                            body: this.env._t(
                                'If you want to recharge wallet then you have to discard this order'
                            ),
                        });
                        if (confirmed) {
                            this.orderIsEmpty(this.env.pos.get_order());
                        }
                    }
                    var product_id = this.env.pos.config.wallet_product[0]
                    var product = this.env.pos.db.get_product_by_id(product_id)
                    var amount = payload["amount"]
                    this.env.pos.get_order().set_is_rounding(false)
                    this.env.pos.get_order().set_type_for_wallet('change');
                    this.env.pos.get_order().add_product(product, {
                        price: amount,
                        extras: {
                            price_manually_set: true,
                        },
                    });
                    this.showScreen('PaymentScreen');
                }
            }
        }
        // if Gift Card is enable
        OpenGiftCardScreen(){
            this.showScreen('GiftCardScreen');
        }
        // if Gift Voucher is enable
        OpenGiftVoucherScreen(){
            this.showScreen('GiftVoucherScreen');
        }
        // if Money In/Out is enable
        async CreateMoneyInOut(event){
            const { confirmed, payload} = await this.showPopup('MoneyInOutPopup', {
                title: this.env._t(event.detail.title),
                type: event.detail.type,
            });
            if(confirmed){
                try {
                    if(!this.env.pos.config.cash_control){
                        this.env.pos.db.notification('danger',this.env._t("Please enable cash control from point of sale settings."));
                        return;
                    }
                    payload['amount'] = this.env.pos.db.thousandsDecimalChanger(payload['amount'])
                    await this.rpc({
                        model: 'pos.session',
                        method: 'take_money_in_out',
                        args: [[this.env.pos.pos_session.id], payload],
                    });
                    if (this.env.pos.config.money_in_out_receipt){
                        var use_posbox = this.env.pos.config.is_posbox && (this.env.pos.config.iface_print_via_proxy);
                        if (use_posbox || this.env.pos.config.other_devices) {
                            const report = this.env.qweb.renderToString('MoneyInOutReceipt',{props: {'check':'from_money_in_out', 'type': payload.type, 'InOutDetail': payload, 'company':this.env.pos.company, 'pos': this.env.pos, 'session':this.env.pos.session, 'date': moment().format('LL')}});
                            const printResult = await this.env.pos.proxy.printer.print_receipt(report);
                            if (!printResult.successful) {
                                await this.showPopup('ErrorPopup', {
                                    title: printResult.message.title,
                                    body: printResult.message.body,
                                });
                            } 
                            this.trigger('close-popup');
                        } else {
                            this.showScreen('ReceiptScreen', {'check':'from_money_in_out', 'type': payload.type, 'InOutDetail': payload, 'company':this.env.pos.company, 'session':this.env.pos.session, 'date': moment().format('LL')});
                            this.trigger('close-popup');
                        }
                    }
                } catch (error) {
                    if (error.message.code < 0) {
                        await this.showPopup('OfflineErrorPopup', {
                            title: this.env._t('Offline'),
                            body: this.env._t('Unable to change background color'),
                        });
                    } else {
                        throw error;
                    }
                }
            }
        }
        // if Bag Charges is enable
        ApplyBagCharges(){
            var product_dict = this.env.pos.db.product_by_id
            var product_by_id = _.filter(product_dict, function(product){
                return product.is_packaging;
            });
            this.state.is_packaging_filter = !this.state.is_packaging_filter
            this.trigger('is_packaging', product_by_id);
        }
        ShowOrderReturnScreen(){
            this.showScreen('OrderReturnScreen');
        }
        ShowMaterialMonitorScreen(){
            this.showScreen('MaterialMonitorScreen');
        }
    }
    MiddelCustomControlButton.template = 'MiddelCustomControlButton';

    Registries.Component.add(MiddelCustomControlButton);

    return MiddelCustomControlButton;
});
 