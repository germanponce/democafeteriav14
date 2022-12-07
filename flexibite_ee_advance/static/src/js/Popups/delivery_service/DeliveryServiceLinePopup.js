odoo.define('flexibite_ee_advance.DeliveryServiceLinePopup', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useState } = owl.hooks;

    class DeliveryServiceLinePopup extends PosComponent {
        constructor() {
            super(...arguments);
        }
        get highlight() {
            if (this.props.selected_service){
                return this.props.selected_service.id !== this.props.service.id ? '' : 'service-box-highlight';
            }else{
                return ''
            }
        }
        get imageUrl() {
            const service = this.props.service;
            return `/web/image?model=pos.delivery.service&field=logo&id=${service.id}&write_date=${service.write_date}&unique=1`;
        }
    }
    DeliveryServiceLinePopup.template = 'DeliveryServiceLinePopup';

    Registries.Component.add(DeliveryServiceLinePopup);

    return DeliveryServiceLinePopup;
});
