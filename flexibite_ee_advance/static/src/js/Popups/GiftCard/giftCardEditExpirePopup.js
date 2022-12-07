odoo.define('flexibite_ee_advance.giftCardEditExpirePopup', function(require) {
    'use strict';

    const { useState, useRef } = owl.hooks;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');

    class giftCardEditExpirePopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            this.state = useState({ NewExpireDate: '', blankNewExpireDate:false});
            this.NewExpireDate = useRef('NewExpireDate');
        }
        getPayload() { 
            return {new_expire_date:this.state.NewExpireDate};
        }
        async confirm() {
            if (this.state.NewExpireDate == ""){
                this.state.blankNewExpireDate = true
            }else{
                this.state.blankNewExpireDate = false
            }
            if (this.state.blankNewExpireDate){
                return
            }
            if (this.state.NewExpireDate != "" && this.props.selectedCard.expire_date > this.state.NewExpireDate){
                $('#lbl_set_available').html("Please Select Date after expire Date !");
                return
            } else {
                this.props.resolve({ confirmed: true, payload: await this.getPayload() });
                this.trigger('close-popup');
            }
            return
          
        }
        cancel() {
            this.trigger('close-popup');
        }
    }
    giftCardEditExpirePopup.template = 'giftCardEditExpirePopup';
    giftCardEditExpirePopup.defaultProps = {
        confirmText: 'Extend',
        cancelText: 'Cancel',
        title: '',
        body: '',
    };

    Registries.Component.add(giftCardEditExpirePopup);

    return giftCardEditExpirePopup;
});
