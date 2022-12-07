odoo.define('flexibite_ee_advance.StatisticBox', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const { useListener } = require('web.custom_hooks');
    const Registries = require('point_of_sale.Registries');
    const { onChangeOrder, useBarcodeReader } = require('point_of_sale.custom_hooks');
    const { useState, useRef } = owl.hooks;

    class StatisticBox extends PosComponent {
        constructor() {
            super(...arguments);
            this.state = useState({orderTotal: this.props.showData.dineIn + this.props.showData.takeAway + this.props.showData.delivery})
        }
        mounted(){
            this.renderChart();
        }
        renderChart(){
            var self = this;
            var data = {
                datasets: [{
                    data: [this.props.showData.dineIn, this.props.showData.takeAway, this.props.showData.delivery],
                    backgroundColor: ["#ff7477","#8bc34a","#00bcd4"],
                    borderColor: '#edf2fb',
                }],
                labels: [
                        'Dine In: '+ this.props.showData.dineIn,
                        'Take Away: '+ this.props.showData.takeAway,
                        'Delivery: '+ this.props.showData.delivery
                      ],
            };
            var options = {
                maintainAspectRatio: true,
                tooltips: {
                    callbacks: {
                        title: function(tooltipItems, data) {
                          return '';
                        },
                        label: function(tooltipItem, data) {
                          var datasetLabel = '';
                          var label = data.labels[tooltipItem.index];
                          return data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index];
                        }
                      }
                    },
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        boxWidth: 10,
                        boxHeight: 10,
                        }
                    },
              };
            var orderDoughnutChart = new Chart($('#chartId'), {
                type: 'doughnut',
                animation:{
                    animateScale:true
                },
                data: data,
                options: options
            });
            setInterval(function() {
                orderDoughnutChart.data.datasets[0].data = [self.props.showData.dineIn, self.props.showData.takeAway, self.props.showData.delivery]
                orderDoughnutChart.data.labels = ['Dine In: '+ self.props.showData.dineIn, 'Take Away: '+ self.props.showData.takeAway, 'Delivery: '+ self.props.showData.delivery]
                orderDoughnutChart.update();
            }, 2000);
        }
    }
    StatisticBox.template = 'StatisticBox';

    Registries.Component.add(StatisticBox);

    return StatisticBox;
});