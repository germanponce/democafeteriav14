odoo.define('flexibite_ee_advance.DeliveryServicePopup', function(require) {
    'use strict';

    const { useState, useRef } = owl.hooks;
    const { useListener } = require('web.custom_hooks');
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');

    class DeliveryServicePopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            this.state = useState({SelectedService:this.props.selected_service})
        }
        ClickService(event){
            let service = event.detail.service
            if (this.state.SelectedService && this.state.SelectedService.id === service.id){
                this.state.SelectedService = null
            }else{
                this.state.SelectedService = service
            }
            this.render();
        }
        getPayload(){
            return {'SelectedService': this.state.SelectedService}
        }
    }
    DeliveryServicePopup.template = 'DeliveryServicePopup';
    DeliveryServicePopup.defaultProps = {
        confirmText: 'Select',
        cancelText: 'Cancel',
        title: '',
        body: '',
    };

    Registries.Component.add(DeliveryServicePopup);

    return DeliveryServicePopup;
});
