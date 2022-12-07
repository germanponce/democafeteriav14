odoo.define('flexibite_ee_advance.Comboline', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useRef } = owl.hooks;

    class Comboline extends PosComponent {
        constructor() {
            super(...arguments);
            this.topRef = useRef('top');
        }
        selectLine() {
            this.trigger('select-line', { comboline: this.props.line, top: this.topRef.el.offsetTop});
        }
        replaceButtonClicked() {
            this.trigger('click-replace-product', { comboline: this.props.line });
        }
        closeButtonClicked(){
            this.trigger('click-close-replacewidget');
        }
        resetButtonClicked() {
            this.trigger('click-reset-product', { comboline: this.props.line });
        }
        categoryClicked() {
            this.trigger('click-category', { comboline: this.props.line });
        }
        ingredientsButtonClicked(){
            this.trigger('click-ingredients', { comboline: this.props.line });
        }
        customiseButtonClicked(){
            this.trigger('click-customise-product', { comboline: this.props.line });
        }
        get addedClasses() {
            return {
                selected: this.props.line.selected,
            };
        }
        get showMax() {
            const max = true ? this.props.line.max > this.props.line.quantity : false;
            return max;
        }
        get imageUrl() {
            if(this.props.line.is_replaced == true){
                const id = this.props.line.replaced_product_id;
                const product = this.props.line.product;
                return `/web/image?model=product.product&field=image_128&id=${id}&write_date=${product.write_date}&unique=1`;
            }else{
                const product = this.props.line.product;
                return `/web/image?model=product.product&field=image_128&id=${product.id}&write_date=${product.write_date}&unique=1`;
            }
        }
    }
    Comboline.template = 'Comboline';

    Registries.Component.add(Comboline);

    return Comboline;
});
