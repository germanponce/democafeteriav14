odoo.define('flexibite_ee_advance.SendToKitchenButton', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');

    class SendToKitchenButton extends PosComponent {
        constructor() {
            super(...arguments);
            useListener('click', this.onClick);
        }
        async onClick(){
            var selectedOrder = this.env.pos.get_order();
            selectedOrder.initialize_validation_date();
            if(selectedOrder.is_empty()){
                return alert ('Please select product!!');
            }else{
                selectedOrder.set_send_to_kitchen(true);
                await this.env.pos.get_order().set_delete_product(false)

                try{
                    const orderLinesState = _.pluck(selectedOrder.orderlines.models, 'state');
                    let orderState;
                    if(orderLinesState.includes('Waiting')){
                        orderState = 'Start';
                    }else if(orderLinesState.includes('Preparing')){
                        orderState = 'Done';
                    }else if(orderLinesState.includes('Delivering')){
                        orderState = 'Deliver';
                    }else if(orderLinesState.includes('Done')){
                        orderState = 'Complete';
                    }
                    selectedOrder.set_order_status(orderState)
                    var orderId = await this.env.pos.push_orders(selectedOrder);
                    selectedOrder.set_server_id(orderId[0]);
                    let orderLineIds = await this.orderLineIds(orderId[0]);
                    for(var line of selectedOrder.get_orderlines()){
                        for(var lineID of orderLineIds){
                            if(line.cid === lineID.line_cid || line.server_id == lineID.server_id){
                                line.set_server_id(lineID.id);
                                line.set_line_state(lineID.state);
                            }
                        }
                    }
                    this.notification();
                    selectedOrder.set_print_order(false)
                } catch(ex){
                    console.warn(this.env._t('Order Not Send, Please check your network connection!'));
                }
            }
        }
        orderLineIds(orderId){
            return this.rpc({
                model: 'pos.order.line',
                method: 'search_read',
                fields: ['line_cid', 'state'],
                domain: [['order_id', '=', orderId]]
            })
        }
    }
    SendToKitchenButton.template = 'SendToKitchenButton';

    ProductScreen.addControlButton({
        component: SendToKitchenButton,
        condition: function() {
            return ['manager', 'waiter'].includes(this.env.pos.user.kitchen_screen_user)  &&
                   this.env.pos.restaurant_mode == 'full_service';
        },
    });

    Registries.Component.add(SendToKitchenButton);

    return SendToKitchenButton;
});
