odoo.define('website.fast.invoicing', function (require) {
    'use strict';
    console.log("ENTRA");

    require('web.dom_ready');
    var ajax = require('web.ajax');
    var core = require('web.core');
    var rpc = require('web.rpc');
    var Dialog = require('web.Dialog');
    var _t = core._t;
    var framework = require('u_fast_invoicing.framework');

    var publicWidget = require('web.public.widget');

    publicWidget.registry.FastInvoicing = publicWidget.Widget.extend({
        selector: '.website_fast_invoicing',

        events: {
            'click a.make-invoice': '_onInvoiceClicked',
            'click a.edit-partner-info': '_onEditInfoClicked',
            'click a.edit-partner-info-pos': '_onEditInfoPosClicked',
            'click a.make-invoice-pos': '_onInvoicePosClicked',
            'click button.oe_search_button': '_onSearchClicked',
            'click a.confirm-button': '_onConfirmClicked',
            'keydown input.search-query': '_onKeyDownSearch',

        },

        /**
         * @constructor
         */
        init: function () {
            this._super.apply(this, arguments);
        },
        /**
         * @override
         */
        start: function () {
            return this._super.apply(this, arguments);
        },
        /**
         *
         */
        _onConfirmClicked: function(e){
            e.preventDefault();
            e.stopPropagation();
            console.log('asdfasdfa');
            console.log("ONCONFIRMCLICK")
        },
        /**
         * TODO
         * @param title
         * @param message
         * @returns {*}
         */
        displayError: function (title, message) {
            return new Dialog(null, {
                title: _t('Error: ') + _.str.escapeHTML(title),
                size: 'medium',
                $content: "<p>" + (_.str.escapeHTML(message) || "") + "</p>",
                buttons: [
                    {text: _t('Ok'), close: true}]
            }).open();
        },
        /**
         *
         */
        _onInvoiceClicked: function () {
            var self = this;
            var access_token = this.$el.data('order');
            var form_values = {
                payment_method: this.$el.find('select[name=payment_method]').val(),
                cfdi_use: this.$el.find('select[name=cfdi_use]').val(),
            };
            framework.blockUI()
            ajax.post('/autofactura/' + access_token + '/direct', form_values).then(function (res) {
                if (res) {
                    $(window.location).attr('href', res);
                } else {
                    self.displayError(_t('RFC'), _t('El número de RFC es requerido para realizar la autofactura.'))
                }
            }).then(function () {
                framework.unblockUI();
            });
        },
        /**
         *
         */
         _submit_values: function(){
            e.preventDefault();
            e.stopPropagation();

            var $form = modal.find('form');
            $form.find(".o_invalid_field").remove();
            var vat_container = $form.find('select[name=vat]');
            var name_container = $form.find('input[name=name]');
            var phone_container = $form.find('input[name=phone]');
            var email_container = $form.find('input[name=email]');
            if (vat_container.length === 0) {
                vat_container = $form.find('input[name=vat]');
            }
            var vat = vat_container.val();
            var name = name_container.val();
            var phone = phone_container.val();
            var email = email_container.val();

            var flag_error = false;
            if (!vat) {
                $form.find('div.vat').append('<div style="color: red;" class="o_invalid_field" aria-invalid="true">El RFC es requerido</div>');
                flag_error = true;
            }
            if (!name){
                $form.find('div.name').append('<div style="color: red;" class="o_invalid_field" aria-invalid="true">El nombre es requerido</div>');
                flag_error = true;
            }
            if (!phone){
                $form.find('div.phone').append('<div style="color: red;" class="o_invalid_field" aria-invalid="true">El telefono es requerido</div>');
                flag_error = true;
            }
            if (!email){
                $form.find('div.email').append('<div style="color: red;" class="o_invalid_field" aria-invalid="true">El correo es requerido</div>');
                flag_error = true;
            }
            if (!flag_error){
                rpc.query({
                route: '/autofactura/vat/validation',
                params: {
                    vat: $form.find('select[name=vat]').val() || $form.find('input[name=vat]').val(),
                    country_id: $form.find('input[name=country_id]').val()
                }
                }).then(function (res) {
                    if (res.error) {
                        $form.find('div.vat').append('<div style="color: red;" class="o_invalid_field" aria-invalid="true">' + res.error + '</div>');
                    } else {
                        vat_container.val(res.vat);
                        $form.submit();

                    }
                })
            }
         },
         /*_search_data : function(){

         },*/

        _onEditInfoClicked: function () {
            var access_token = this.$el.data('order');
            var form_values = {
                payment_method: this.$el.find('select[name=payment_method]').val(),
                cfdi_use: this.$el.find('select[name=cfdi_use]').val(),
            };
            framework.blockUI();

            return $.get('/autofactura/invoicing/' + access_token, form_values).done(function (response) {
                var modal = $(response);
                var self = this;
                modal.modal('show');
                modal.on('click', '.search', function (e){
                    var $form = modal.find('form');
                    e.preventDefault();
                    e.stopPropagation();
                    $form.find(".o_invalid_field").remove();

                    var vat_container = $form.find('input[name=vat]');
                    var name_container = $form.find('input[name=name]');
                    var phone_container = $form.find('input[name=phone]');
                    var email_container = $form.find('input[name=email]');

                    var vat = vat_container.val();
                    if (!vat) {
                        $form.find('div.vat').append('<div style="color: red;" class="o_invalid_field" aria-invalid="true">El RFC es requerido</div>');
                        
                    }
                    rpc.query({
                        route: '/autofactura/autocomplete',
                        params: {
                            vat: $form.find('input[name=vat]').val()
                        }
                    }).then(function(data){
                        // Aqui hacemos el autocompletamiento
                        name_container.val(data.name);
                        phone_container.val(data.phone);
                        email_container.val(data.email);

                        if (vat){
                            if (data.partner == true){
                                name_container.prop("disabled", true );
                                phone_container.prop("disabled", true );
                                email_container.prop("disabled", true );
                            }else{
                                name_container.prop("disabled", false);
                                phone_container.prop("disabled", false);
                                email_container.prop("disabled", false);
                            }
                            $('#name-grouper').css('display','');
                            $('#phone-grouper').css('display','');
                            $('#email-grouper').css('display','');
                        }
                        $('button.submit').prop('disabled', false);
                    })
                });
                modal.on('click', 'button.submit', function (e) {
                    self._submit_values;
                });

            }).then(function () {
                framework.unblockUI();
            });
        },
        /**
         *
         */
        _onEditInfoPosClicked: function () {
            var access_token = this.$el.data('order');
            var form_values = {
                cfdi_use: this.$el.find('select[name=cfdi_use]').val(),
                tpv: 1
            };

            framework.blockUI();
            return $.get('/autofactura/invoicing/pos/' + access_token, form_values).done(function (response) {
                var modal = $(response);
                modal.modal('show');
                modal.on('click', '.search', function (e){
                    var $form = modal.find('form');
                    e.preventDefault();
                    e.stopPropagation();
                    $form.find(".o_invalid_field").remove();
                    $('button.submit').prop('disabled', true);

                    var vat_container = $form.find('input[name=vat]');
                    var name_container = $form.find('input[name=name]');
                    var phone_container = $form.find('input[name=phone]');
                    var email_container = $form.find('input[name=email]');

                    var vat = vat_container.val();

                    if (!vat) {
                        $form.find('#vat-grouper').after('<div style="color: red; text-align:center;" class="o_invalid_field" aria-invalid="true">El RFC es requerido.</div>');
                        $('#name-grouper').css('display','none');
                        $('#phone-grouper').css('display','none');
                        $('#email-grouper').css('display','none');
                        return;
                    }
                    if (vat){
                        rpc.query({
                            model: 'res.partner',
                            method: 'check_vat_mx',
                            args: [[], vat],
                        }).then(function (result){
                            if(result === true){
                                rpc.query({
                                    route: '/autofactura/autocomplete',
                                    params: {
                                        vat: $form.find('input[name=vat]').val()
                                    }
                                }).then(function(data){
                                    // Aqui hacemos el autocompletamiento
                                    name_container.val(data.name);
                                    phone_container.val(data.phone);
                                    email_container.val(data.email);
                                    $('button.submit').prop('disabled', false);
            
                                    if(vat){
                                            if (data.partner == true){
                                                name_container.prop("disabled", true );
                                                phone_container.prop("disabled", true );
                                                email_container.prop("disabled", true );
            
                                            }else{
                                                name_container.prop("disabled", false);
                                                phone_container.prop("disabled", false);
                                                email_container.prop("disabled", false);
                                            }}
                                            $('#name-grouper').css('display','');
                                            $('#phone-grouper').css('display','');
                                            $('#email-grouper').css('display','');
                                })
                            }
                            if(result === false){
                                $form.find('#vat-grouper').after('<div style="color: red; text-align:center;" class="o_invalid_field" aria-invalid="true">El RFC introducido es incorrecto.</div>');
                                $('#name-grouper').css('display','none');
                                $('#phone-grouper').css('display','none');
                                $('#email-grouper').css('display','none');
                                return;
                            }
                        })      
                    } 
                });
                modal.on('click', 'button.submit', function (e) {
                    self._submit_values;
                    
                });
            }).then(function () {
                framework.unblockUI();
            });
        },
        /**
         *
         */
        _onInvoicePosClicked: function () {
            var self = this;
            var access_token = this.$el.data('order');
            var form_values = {
                cfdi_use: this.$el.find('select[name=cfdi_use]').val(),
                tpv: 1
            };
            framework.blockUI();
            ajax.post('/autofactura/' + access_token + '/direct', form_values).then(function (res) {
                if (res) {
                    $(window.location).attr('href', res);
                } else {
                    self.displayError(_t('RFC'), _t('El número de RFC es requerido para realizar la auto factura.'))
                }
            }).then(function () {
                framework.unblockUI();
            });
        },
        /**
         *
         */

        _onSearchClicked: function () {
            var self = this;
            var search_query = this.$el.find('input.search-query').val();
            if (search_query) { 
                return ajax.jsonRpc('/autofactura/search', 'call', {
                    search: search_query
                }).then(function (res) {
                    var access_token = res.access_token;
                    if (access_token) {
                        if (res.is_pos) {
                            window.location.href = '/autofactura/pedido/tpv/' + access_token;
                        } else {
                            window.location.href = '/autofactura/pedido/' + access_token;
                        }
                    } else {
                        $.get('/autofactura/search/not_found?search_query=' + search_query).done(function (response) {
                            self.$el.append($(response));
                        });
                    }
                });
            } else{
                $.get('/autofactura/search/not_found/null').done(function (response) {
                    self.$el.append($(response));
                });
            }
        },
        /**
         *
         *
         * @private
         * @param event
         */
        _onKeyDownSearch: function (event) {
            var self = this;
            switch (event.keyCode) {
                case $.ui.keyCode.ENTER:
                    event.preventDefault();
                    self._onSearchClicked();
                    break;
            }
        },
    });

    publicWidget.registry.FastInvoicingError = publicWidget.Widget.extend({
        selector: '.website_fast_invoicing_error',

        events: {
            'click .o_fi_clipboard_button': '_onMessagePostClick',
        },

        /**
         * @constructor
         */
        init: function () {
            this._super.apply(this, arguments);
            this.sendCounter = 0;
        },

        _onMessagePostClick: function (ev) {
            var self = this;
            var $btn = $(ev.currentTarget);
            if (this.sendCounter > 0) {
                return;
            }
            $btn.tooltip({
                title: _t('Enviado !'),
                trigger: "manual",
                placement: "bottom"
            });
            var orderId = $btn.data('id');
            ajax.jsonRpc('/autofactura/message/post', 'call', {
                order_id: orderId,
                message: this.$('#o_error_message').html()
            }).then(function (data) {
                if (data) {
                    self.sendCounter += 1;
                    $btn.attr('disabled', true);
                    _.defer(function () {
                        $btn.tooltip("show");
                        _.delay(function () {
                            $btn.tooltip("hide");
                        }, 800);
                    });
                }
            }).guardedCatch(function () {
                alert("Error");
            });
        }
    });
});