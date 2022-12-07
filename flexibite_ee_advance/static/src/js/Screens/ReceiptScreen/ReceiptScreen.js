odoo.define('flexibite_ee_advance.ReceiptScreen', function(require) {
    'use strict';

    const ReceiptScreen = require('point_of_sale.ReceiptScreen')
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');


    const PosCustReceiptScreen = ReceiptScreen =>
        class extends ReceiptScreen {
            orderDone() {
                super.orderDone(...arguments);
                if(this.env.pos.config.customer_display && this.currentOrder){
                    this.currentOrder.mirror_image_data();
                }
            }
        };

    Registries.Component.extend(ReceiptScreen, PosCustReceiptScreen);

    return ReceiptScreen;
});
