// sap.ui.define([
// 	"sap/ui/core/mvc/Controller"
// ], function(Controller) {
// 	"use strict";

// 	return Controller.extend("ZDailySalesMaterialSummaryArjas.controller.View1", {

// 	});
// });

sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/BusyIndicator",
	"sap/viz/ui5/data/FlattenedDataset",
	"sap/viz/ui5/controls/common/feeds/FeedItem",
	"sap/m/MessageBox",
	"sap/m/VBox",
	"sap/ui/core/Icon",
	"sap/m/Text",
	"sap/m/Button"
], function(Controller,
	Filter,
	FilterOperator,
	BusyIndicator,
	FlattenedDataset,
	FeedItem, MessageBox, VBox,
	Icon,
	Text,
	Button) {
	"use strict";

	return Controller.extend(
		"ZDailySalesMaterialSummaryArjas.controller.View1", {

			onInit: function() {
				this._oModel = this.getOwnerComponent().getModel();
				this._oSmartFilterBar = this.byId("smartFilterBar");

				// 🔹 Material group description map
				this._mMatGroupDesc = {};

				// ✅ SAFE Cross App Navigation (FLP only)
				this._oCrossAppNav = null;
				if (sap.ushell && sap.ushell.Container) {
					this._oCrossAppNav =
						sap.ushell.Container.getService("CrossApplicationNavigation");
				}

				var that = this;

				// this._oModel.metadataLoaded().then(function() {
				// 	that._oSmartFilterBar.attachInitialized(function() {

				// 		// ✅ SAME default month logic as existing app
				// 		var oNow = new Date();
				// 		var sDefaultMonth =
				// 			oNow.getFullYear().toString() +
				// 			("0" + (oNow.getMonth() + 1)).slice(-2);

				// 		that._oSmartFilterBar.setFilterData({
				// 			CALMONTH: {
				// 				ranges: [{
				// 					operation: "EQ",
				// 					value1: sDefaultMonth
				// 				}]
				// 			}
				// 		});

				// 		that.onSearch();
				// 	});
				// });
				// 1️⃣ Load descriptions in parallel (non-blocking)
				this._loadMaterialGroupDescriptions();

				// 2️⃣ WAIT for SmartFilterBar initialization
				this._oSmartFilterBar.attachInitialized(function() {

					// ✅ Apply default month ONLY here
					var oNow = new Date();
					var sDefaultMonth =
						oNow.getFullYear().toString() +
						("0" + (oNow.getMonth() + 1)).slice(-2);

					that._oSmartFilterBar.setFilterData({
						CALMONTH: {
							ranges: [{
								operation: "EQ",
								value1: sDefaultMonth
							}]
						}
					});

					// ✅ THIS is mandatory
					that._oSmartFilterBar.search();
				});

			},
			onSearch: function() {
				BusyIndicator.show(0);

				this._readPieData().then(function(oResult) {
					BusyIndicator.hide();
					// this._renderPieChart(aData);
					this._renderPieChart(oResult.data, oResult.monthTotalQty);
				}.bind(this)).catch(function() {
					BusyIndicator.hide();
				});
			},
			_loadMaterialGroupDescriptions: function() {

				var that = this;
				// BusyIndicator.show(0);
				var aAllowedGroups = [
					"Z050", "Z051", "Z069", "Z070",
					"Z072", "Z073", "Z074", "Z075",
					"Z077", "Z100", "Z101", "Z102"
				];

				that._oModel.read("/ZVH_MGRP_DEC", {
					urlParameters: {
						$select: "matl_group,txtsh",
						$top: "1000"
					},
					success: function(oData) {

						oData.results.forEach(function(r) {
							if (r.matl_group && aAllowedGroups.includes(r.matl_group)) {
								that._mMatGroupDesc[r.matl_group] =
									r.matl_group + " - " + (r.txtsh || "");
							}
						});
						// BusyIndicator.hide();
						// 🔹 Optional: refresh chart labels if already rendered
						if (that.byId("pieChart")) {
							that.onSearch();
						}
					}
				});
			},

			_readPieData: function() {
				var that = this;

				// ✅ Hard-coded material groups
				var aMaterialGroups = [
					"Z050", "Z051", "Z069", "Z070",
					"Z072", "Z073", "Z074", "Z075",
					"Z077", "Z100", "Z101", "Z102"
				];

				return new Promise(function(resolve, reject) {

					var oFilterData = that._oSmartFilterBar.getFilterData();
					var aFilters = [];

					/* ---------------------------
					   Date filter
					----------------------------*/
					if (
						oFilterData.CALDAY &&
						oFilterData.CALDAY.ranges &&
						oFilterData.CALDAY.ranges.length > 0
					) {
						var rDay = oFilterData.CALDAY.ranges[0];
						aFilters.push(
							new Filter(
								"CALDAY",
								rDay.operation === "BT" ? FilterOperator.BT : FilterOperator.EQ,
								rDay.value1,
								rDay.value2
							)
						);
					} else if (
						oFilterData.CALMONTH &&
						oFilterData.CALMONTH.ranges &&
						oFilterData.CALMONTH.ranges.length > 0
					) {
						var rMonth = oFilterData.CALMONTH.ranges[0];
						aFilters.push(
							new Filter(
								"CALMONTH",
								rMonth.operation === "BT" ? FilterOperator.BT : FilterOperator.EQ,
								rMonth.value1,
								rMonth.value2
							)
						);
					}

					/* ---------------------------
					   Plant filter (OR)
					----------------------------*/
					if (
						oFilterData.plant &&
						oFilterData.plant.ranges &&
						oFilterData.plant.ranges.length > 0
					) {
						var aPlantFilters = [];
						for (var i = 0; i < oFilterData.plant.ranges.length; i++) {
							aPlantFilters.push(
								new Filter(
									"plant",
									FilterOperator.EQ,
									oFilterData.plant.ranges[i].value1
								)
							);
						}
						aFilters.push(new Filter({
							filters: aPlantFilters,
							and: false
						}));
					}

					/* ---------------------------
					   Company Code filter (OR)
					----------------------------*/
					if (
						oFilterData.comp_code &&
						oFilterData.comp_code.ranges &&
						oFilterData.comp_code.ranges.length > 0
					) {
						var aCompFilters = [];
						for (var j = 0; j < oFilterData.comp_code.ranges.length; j++) {
							aCompFilters.push(
								new Filter(
									"comp_code",
									FilterOperator.EQ,
									oFilterData.comp_code.ranges[j].value1
								)
							);
						}
						aFilters.push(new Filter({
							filters: aCompFilters,
							and: false
						}));
					}

					/* ---------------------------
					   OData Read
					----------------------------*/
					that._oModel.read("/Zsales_Daily_Update", {
						filters: aFilters,
						urlParameters: {
							$select: "matl_group,INV_QTY"
						},
						success: function(oData) {

							var aResults = oData.results || [];
							var aTotals = [];

							// Initialize totals with 0 for each group
							for (var g = 0; g < aMaterialGroups.length; g++) {
								aTotals[g] = 0;
							}

							// Aggregate backend data
							for (var k = 0; k < aResults.length; k++) {
								var sGroup = aResults[k].matl_group;
								var fQty = parseFloat(aResults[k].INV_QTY) || 0;

								var idx = aMaterialGroups.indexOf(sGroup);
								if (idx !== -1) {
									aTotals[idx] = aTotals[idx] + fQty;
								}
							}

							// Prepare final result
							var aFinalData = [];
							var bHasData = false;
							var fMonthTotalQty = 0;

							for (var m = 0; m < aMaterialGroups.length; m++) {
								if (aTotals[m] > 0) {
									bHasData = true;
									fMonthTotalQty += aTotals[m];
								}
								// aFinalData.push({
								// 	matl_group: aMaterialGroups[m],
								// 	total_qty: aTotals[m]
								// });
								var sCode = aMaterialGroups[m];

								aFinalData.push({
									matl_group: sCode, // PURE code (used for navigation)
									matl_group_text: that._mMatGroupDesc[sCode] || sCode,
									total_qty: aTotals[m]
								});
							}

							// ✅ NO DATA HANDLING
							if (!bHasData) {
								resolve([]);
								return;
							}

							resolve({
								data: aFinalData,
								monthTotalQty: fMonthTotalQty
							});
						},
						error: function(oError) {
							reject(oError);
						}
					});

				});
			},

			_renderPieChart: function(aData, fMonthTotalQty) {

				var oContainer = this.byId("contentBox");
				var oViz = this.byId("pieChart");

				oContainer.removeAllItems();

				// ==============================
				// NO DATA UI
				// ==============================
				if (!aData || aData.length === 0) {

					// 🔴 IMPORTANT: hide chart
					oViz.setVisible(false);

					var oNoDataVBox = new sap.m.VBox({
						width: "100%",
						height: "400px",
						justifyContent: "Center",
						alignItems: "Center",
						items: [
							new sap.ui.core.Icon({
								src: "sap-icon://database",
								size: "4rem",
								color: "#6a6d70"
							}),
							new sap.m.Text({
								text: "No Data Available",
								design: "Bold",
								textAlign: "Center"
							}),
							new sap.m.Text({
								text: "No records found for the selected filters.",
								textAlign: "Center"
							}),
							new sap.m.Button({
								text: "Try Again",
								icon: "sap-icon://refresh",
								type: "Emphasized",
								press: function() {
									this.onSearch();
								}.bind(this)
							})
						]
					});

					oContainer.addItem(oNoDataVBox);
					return;
				}

				// ==============================
				// DATA EXISTS → SHOW CHART
				// ==============================
				oViz.setVisible(true);
				oContainer.addItem(oViz);

				var oDataset = new sap.viz.ui5.data.FlattenedDataset({
					dimensions: [{
						name: "Material Group",
						// value: "{matl_group}"
						value: "{matl_group_text}"
					}],
					measures: [{
						name: "Total Quantity",
						value: "{total_qty}"
					}],
					data: {
						path: "/data"
					}
				});

				var oJsonModel = new sap.ui.model.json.JSONModel({
					data: aData
				});

				oViz.setDataset(oDataset);
				oViz.setModel(oJsonModel);

				oViz.setVizProperties({
					title: {
						text: "Material Group Wise Total Quantity Of The Month – " +
							(fMonthTotalQty ? fMonthTotalQty.toFixed(2) : "0.00"),
						visible: true
					},
					plotArea: {
						dataLabel: {
							visible: false
						}
					},
					legend: {
						isScrollable: true
					}
				});

				oViz.removeAllFeeds();
				oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
					uid: "color",
					type: "Dimension",
					values: ["Material Group"]
				}));
				oViz.addFeed(new sap.viz.ui5.controls.common.feeds.FeedItem({
					uid: "size",
					type: "Measure",
					values: ["Total Quantity"]
				}));

				// ==============================
				// ADD VIZ POPOVER (HERE ONLY)
				// ==============================
				if (!this._oVizPopover) {
					this._oVizPopover = new sap.viz.ui5.controls.Popover({
						formatString: ["#,##0.00"]
					});
				}
				this._oVizPopover.connect(oViz.getVizUid());

				// ✅ ADD THIS
				oViz.detachSelectData(this.onPieSelect, this);
				oViz.attachSelectData(this.onPieSelect, this);
			},
			// onPieSelect: function(oEvent) {

			// 	// Safety check
			// 	var aData = oEvent.getParameter("data");
			// 	if (!aData || !aData[0] || !aData[0].data) {
			// 		return;
			// 	}

			// 	// Material Group from slice
			// 	// var sMatGroup = aData[0].data.matl_group;

			// 	// 🔹 VizFrame returns dimension text, not model property name
			// 	var sMatGroup =
			// 		aData[0].data["Material Group"] ||
			// 		aData[0].data["matl_group"];

			// 	if (!sMatGroup) {
			// 		return;
			// 	}

			// 	// Read SmartFilterBar values
			// 	var oFilterData = this._oSmartFilterBar.getFilterData();

			// 	var oParams = {
			// 		matl_group: sMatGroup
			// 	};

			// 	// Pass Month
			// 	if (oFilterData.CALMONTH &&
			// 		oFilterData.CALMONTH.ranges &&
			// 		oFilterData.CALMONTH.ranges.length) {

			// 		oParams.CALMONTH = oFilterData.CALMONTH.ranges[0].value1;
			// 	}

			// 	// Pass Plant
			// 	if (oFilterData.plant &&
			// 		oFilterData.plant.ranges &&
			// 		oFilterData.plant.ranges.length) {

			// 		oParams.plant = oFilterData.plant.ranges[0].value1;
			// 	}

			// 	// Pass Company Code
			// 	if (oFilterData.comp_code &&
			// 		oFilterData.comp_code.ranges &&
			// 		oFilterData.comp_code.ranges.length) {

			// 		oParams.comp_code = oFilterData.comp_code.ranges[0].value1;
			// 	}

			// 	if (!this._oCrossAppNav) {
			// 		MessageBox.warning(
			// 			"Cross-application navigation is available only in Fiori Launchpad."
			// 		);
			// 		return;
			// 	}

			// 	this._oCrossAppNav.toExternal({
			// 		target: {
			// 			semanticObject: "ZSalesDashboard",
			// 			action: "dailySalesUpd"
			// 		},
			// 		params: oParams
			// 	});
			// }
			onPieSelect: function(oEvent) {

				var aData = oEvent.getParameter("data");
				if (!aData || !aData[0] || !aData[0].data) {
					return;
				}

				// 🔹 VizFrame returns dimension text
				// var sMatGroup =
				// 	aData[0].data["Material Group"] ||
				// 	aData[0].data["matl_group"];

				// if (!sMatGroup) {
				// 	return;
				// }
				var sText =
					aData[0].data["Material Group"] ||
					aData[0].data["matl_group"];

				if (!sText) {
					return;
				}

				// 🔹 Extract code before hyphen
				var sMatGroup = sText.split(" - ")[0];

				var oFilterData = this._oSmartFilterBar.getFilterData();
				var oParams = {};

				// ✅ Material Group (MANDATORY)
				oParams.matl_group = [sMatGroup];

				// ✅ Month (only if present)
				if (oFilterData.CALMONTH &&
					oFilterData.CALMONTH.ranges &&
					oFilterData.CALMONTH.ranges.length) {

					oParams.CALMONTH = [
						oFilterData.CALMONTH.ranges[0].value1
					];
				}

				// ✅ Plant
				if (oFilterData.plant &&
					oFilterData.plant.ranges &&
					oFilterData.plant.ranges.length) {

					oParams.plant = [
						oFilterData.plant.ranges[0].value1
					];
				}

				// ✅ Company Code
				if (oFilterData.comp_code &&
					oFilterData.comp_code.ranges &&
					oFilterData.comp_code.ranges.length) {

					oParams.comp_code = [
						oFilterData.comp_code.ranges[0].value1
					];
				}

				if (!this._oCrossAppNav) {
					MessageBox.warning(
						"Cross-application navigation is available only in Fiori Launchpad."
					);
					return;
				}

				this._oCrossAppNav.toExternal({
					target: {
						semanticObject: "ZSalesDashboard",
						action: "dailySalesUpd"
					},
					params: oParams
				});
			}

		});
});