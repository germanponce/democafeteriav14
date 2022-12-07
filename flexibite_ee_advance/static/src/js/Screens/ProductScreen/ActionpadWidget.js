odoo.define('flexibite_ee_advance.ActionpadWidget', function(require) {
    'use strict';

    const ActionpadWidget = require('point_of_sale.ActionpadWidget');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useState } = owl.hooks;

    const AsplResActionpadWidget = (ActionpadWidget) =>
        class extends ActionpadWidget {
            constructor() {
                super(...arguments);
                this.state = useState({ orderTypeMode: this.currentOrder.get_order_type(), orderDeliveryService: this.currentOrder.get_delivery_service()});
                this.currentOrder.set_order_type(this.state.orderTypeMode)
                this.currentOrder.set_delivery_service(this.state.orderDeliveryService)
            }
            async changeMode(id) {
                this.state.orderTypeMode = this.env.pos.order_type_data[id][0];
                if (this.env.pos.order_type_data && this.env.pos.order_type_data[id] && this.env.pos.order_type_data[id][0] && this.env.pos.order_type_data[id][0] === 'Delivery'){
                    var delivery_service_ids = this.env.pos.delivery_service.filter(service => this.env.pos.config.delivery_service_ids.includes(service.id))
                    const { confirmed, payload } = await this.showPopup('DeliveryServicePopup', {
                        title: this.env._t('Select Delivery Service'),
                        services: delivery_service_ids,
                        selected_service: this.state.orderDeliveryService
                    });
                    if (confirmed){
                        this.currentOrder.set_delivery_service(payload.SelectedService)
                        this.state.orderDeliveryService = payload.SelectedService
                    }
                }else{
                    this.currentOrder.set_delivery_service(null)
                }
                this.trigger('set-order-type-mode',this.state.orderTypeMode);
                this.currentOrder.set_order_type(this.state.orderTypeMode);
            }
            getTypeName(id){
                return this.env.pos.order_type_data[id][0];
            }
            get currentOrder(){
                return this.env.pos.get_order();
            }
        };

    Registries.Component.extend(ActionpadWidget, AsplResActionpadWidget);

    return ActionpadWidget;
});
