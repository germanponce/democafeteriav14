odoo.define('flexibite_ee_advance.FilterSwitch', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useState } = owl.hooks;

    class FilterSwitch extends PosComponent {
        constructor() {
            super(...arguments);
            this.state = useState({ dineIn : true, takeAway: true, delivery: true})
        }
        clickDineIn(){
            if(this.state.dineIn){
                this.state.dineIn = false;
            }else{
                this.state.dineIn = true;
            }
            this.trigger('click-dine-in', {'dineIn' : this.state.dineIn})
        }
        clickTakeAway(){
            if(this.state.takeAway){
                this.state.takeAway = false;
            }else{
                this.state.takeAway = true;
            }
            this.trigger('click-take-away', {'takeAway' : this.state.takeAway})
        }
        clickDelivery(){
            if(this.state.delivery){
                this.state.delivery = false;
            }else{
                this.state.delivery = true;
            }
            this.trigger('click-delivery', {'delivery' : this.state.delivery})
        }
        get showDineIn(){
            return this.props.orderTypeList.dineIn == 'Dine In'
        }
        get showTakeAway(){
            return this.props.orderTypeList.takeAway == 'Take Away'
        }
        get showDelivery(){
            return this.props.orderTypeList.delivery == 'Delivery'
        }
        get dineInClass(){
            if(this.state.dineIn){
                return 'selected';
            }
        }
        get takeAwayClass(){
            if(this.state.takeAway){
                return 'selected';
            }
        }
        get deliveryClass(){
            if(this.state.delivery){
                return 'selected';
            }
        }

    }
    FilterSwitch.template = 'FilterSwitch';

    Registries.Component.add(FilterSwitch);

    return FilterSwitch;
});
