odoo.define('flexibite_ee_advance.OrderCardLine', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const { nextFrame } = require('point_of_sale.utils');
    const Registries = require('point_of_sale.Registries');
    const { useState, useRef } = owl.hooks;

    class OrderCardLine extends PosComponent {
        constructor() {
            super(...arguments);
            this.orderLine = useRef('orderLine')
        }
        async clickLineState(){
            if(this.props.line.state == 'Waiting'){
                this.props.line.state = 'Preparing';
            }else if(this.props.line.state == 'Preparing'){
                this.props.line.state = 'Delivering';
            }
            await this.rpc({
                model: 'pos.order.line',
                method: 'update_orderline_state',
                args: [{'state': this.props.line.state,
                        'order_line_id':this.props.line.id,
                        'order_id': this.props.line.order_id}],
            });
            this.trigger('click-line-state')
        }
        get textStyle(){
            if(this.props.line.state == 'Delivering'){
                return 'line-through'
            }
        }
        async printLine(){
            if (this.env.pos.proxy.printer) {
                const report = this.env.qweb.renderToString('OrderLinePrint',
                                    Object.assign({
                                        line: this.props.line,
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
    OrderCardLine.template = 'OrderCardLine';

    Registries.Component.add(OrderCardLine);

    return OrderCardLine;
});
