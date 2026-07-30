import { it } from "vitest";
import { reconcileForOrder, productFromOrder } from "@/lib/orders";
import { buildSigLine } from "@/lib/sigLine";
it("p", () => {
  const o: any = { id:"1",patientId:"p",drugName:"x",status:"draft",productName:"3 ML insulin glargine 100 UNT/ML Pen Injector",strengthText:"100 UNT/ML",doseForm:"Pen Injector",doseTargetUnits:18};
  console.log(JSON.stringify(reconcileForOrder(o)));
  const t: any = { id:"1",patientId:"p",drugName:"x",status:"draft",productName:"hydrocortisone acetate 10 MG/ML Topical Cream",strengthText:"10 MG/ML"};
  console.log(buildSigLine({product: productFromOrder(t), dose: undefined, applicationInstruction:"thin layer to affected area", frequencyLabel:"twice daily"}));
});
