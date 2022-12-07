odoo.define('flexibite_ee_advance.SliderContent', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class SliderContent extends PosComponent {}
    SliderContent.template = 'SliderContent';

    Registries.Component.add(SliderContent);

    return SliderContent;
});
