odoo.define('flexibite_ee_advance.TicketScreen', function(require) {
    'use strict';

    const TicketScreen = require('point_of_sale.TicketScreen');
    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    const AsplResTicketScreen = TicketScreen =>
        class extends TicketScreen {
            async deleteOrder(order) {
                let flag = false;
                _.each(order.get_orderlines(),function(line){
                    if(line.state != 'Waiting'){
                        flag = true;
                        return;
                    }
                });
                if(flag){
                    alert('You can not delete this order!')
                }else{
                    super.deleteOrder(...arguments)
                }
            }
            selectOrder(order) {
                super.selectOrder(...arguments);
                if(this.env.pos.config.customer_display){
                    this.env.pos.get_order().mirror_image_data();
                }
            }
        };

    Registries.Component.extend(TicketScreen, AsplResTicketScreen);

    return TicketScreen;
});
