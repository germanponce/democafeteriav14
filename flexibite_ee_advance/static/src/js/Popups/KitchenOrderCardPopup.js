odoo.define('flexibite_ee_advance.KitchenOrderCardPopup', function (require) {
    'use strict';

    const { useState, useExternalListener } = owl.hooks;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');

    class KitchenOrderCardPopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
        }
        _cancelAtClick(event){
            this.cancel();
        }
        get headerClass(){
            if(this.props.order.order_type == 'Dine In'){
                return '#ff7477';
            }else if(this.props.order.order_type == 'Take Away'){
                return '#8bc34a';
            }else if(this.props.order.order_type == 'Delivery'){
                return '#00bcd4';
            }
        }
        get imageUrl() {
            if(this.isDineIn){
                return `/flexibite_ee_advance/static/src/img/table.png`;
            }else if(this.isTakeAway){
                return `/flexibite_ee_advance/static/src/img/takeaway.png`;
            }else if(this.isDelivery){
                return `/flexibite_ee_advance/static/src/img/delivery.png`;
            }
        }
        get isDineIn(){
            return this.props.order.order_type == 'Dine In';
        }
        get isTakeAway(){
            return this.props.order.order_type == 'Take Away';
        }
        get isDelivery(){
            return this.props.order.order_type == 'Delivery';
        }
        async clickDeliver(){
            await this.rpc({
                model: 'pos.order.line',
                method: 'update_all_orderline_state',
                args: [{'order_state': 'Deliver',
                        'line_state': 'done',
                        'order_id': this.props.order.order_id}],
            });
            this.cancel();
        }
        async printOrder(){
            if (this.env.pos.proxy.printer) {
                const report = this.env.qweb.renderToString('OrderPrint',
                                    Object.assign({
                                        order: this.props.order
                                    })
                                );
                const printResult = await this.env.pos.proxy.printer.print_receipt(report);
                if (printResult.successful) {
                    return true;
                } else {
                    const { confirmed } = await this.showPopup('ConfirmPopup', {
                        title: printResult.message.title,
                        body: 'Do you want to print using the web printer?',
                    });
                    if (confirmed) {
                        // We want to call the _printWeb when the popup is fully gone
                        // from the screen which happens after the next animation frame.
                        await nextFrame();
//                        return await this._printWeb();
                    }
                    return false;
                }
            } else {
//                return await this._printWeb();
            }
        }
    }
    KitchenOrderCardPopup.template = 'KitchenOrderCardPopup';


    Registries.Component.add(KitchenOrderCardPopup);

    return KitchenOrderCardPopup;
});
