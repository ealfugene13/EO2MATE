import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  supabase,
} from "../supabase";


const EMPTY_ITEM = {
  inventory_item_id: "",
  inventory_owner_id: "",
  item_code: "",
  item_name: "",
  description: "",
  default_selling_price: "",
  opening_quantity: "",
  status: "ACTIVE",
};


const EMPTY_OWNER = {
  owner_type_code:
    "CONSIGNOR",

  owner_code:
    "",

  owner_name:
    "",

  contact_name:
    "",

  mobile_no:
    "",

  email:
    "",

  notes:
    "",
};


function money(
  value,
) {
  const amount =
    Number(
      value ||
      0,
    );

  return new Intl.NumberFormat(
    "en-PH",
    {
      style:
        "currency",

      currency:
        "PHP",

      maximumFractionDigits:
        2,
    },
  ).format(
    Number.isFinite(
      amount,
    )
      ? amount
      : 0,
  );
}


function qty(
  value,
) {
  const amount =
    Number(
      value ||
      0,
    );

  if (
    !Number.isFinite(
      amount,
    )
  ) {
    return "0";
  }

  return new Intl.NumberFormat(
    "en-PH",
    {
      maximumFractionDigits:
        4,
    },
  ).format(
    amount,
  );
}


function primaryImage(
  item,
) {
  const images =
    item
      ?.images ||
    [];

  return (
    images.find(
      (
        image,
      ) =>
        image
          .is_primary ===
        true,
    ) ||
    images[
      0
    ] ||
    null
  );
}


function statusClass(
  status,
) {
  const value =
    String(
      status ||
      "",
    )
      .trim()
      .toUpperCase();

  if (
    value ===
    "ACTIVE" ||
    value ===
    "VALID" ||
    value ===
    "IMPORTED" ||
    value ===
    "COMPLETED"
  ) {
    return "inventory-status-good";
  }

  if (
    value ===
    "WARNING" ||
    value ===
    "PARTIAL"
  ) {
    return "inventory-status-warn";
  }

  if (
    value ===
    "ERROR" ||
    value ===
    "FAILED"
  ) {
    return "inventory-status-bad";
  }

  return "inventory-status-muted";
}


export default function InventoryPage({
  client,
}) {
  const imageInputRef =
    useRef(
      null,
    );

  const importInputRef =
    useRef(
      null,
    );

  const [
    owners,
    setOwners,
  ] =
    useState(
      [],
    );

  const [
    ownerTypes,
    setOwnerTypes,
  ] =
    useState(
      [],
    );

  const [
    items,
    setItems,
  ] =
    useState(
      [],
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      "",
    );

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState(
      "ACTIVE",
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    processing,
    setProcessing,
  ] =
    useState(
      false,
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      "",
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      "",
    );

  const [
    itemModal,
    setItemModal,
  ] =
    useState(
      false,
    );

  const [
    itemForm,
    setItemForm,
  ] =
    useState(
      {
        ...EMPTY_ITEM,
      },
    );

  const [
    ownerModal,
    setOwnerModal,
  ] =
    useState(
      false,
    );

  const [
    ownerForm,
    setOwnerForm,
  ] =
    useState(
      {
        ...EMPTY_OWNER,
      },
    );

  const [
    selectedItem,
    setSelectedItem,
  ] =
    useState(
      null,
    );

  const [
    stockModal,
    setStockModal,
  ] =
    useState(
      false,
    );

  const [
    stockForm,
    setStockForm,
  ] =
    useState(
      {
        movement_type_code:
          "RECEIPT",

        quantity:
          "",

        remarks:
          "",
      },
    );

  const [
    imageModal,
    setImageModal,
  ] =
    useState(
      false,
    );

  const [
    importModal,
    setImportModal,
  ] =
    useState(
      false,
    );

  const [
    importPreview,
    setImportPreview,
  ] =
    useState(
      null,
    );

  const [
    duplicateStrategy,
    setDuplicateStrategy,
  ] =
    useState(
      "SKIP",
    );


  useEffect(
    () => {
      if (
        client
          ?.client_id
      ) {
        initialize();
      }
    },
    [
      client
        ?.client_id,
    ],
  );


  async function invoke(
    body,
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .functions
        .invoke(
          "inventory-admin",
          {
            method:
              "POST",

            body,
          },
        );

    if (error) {
      throw error;
    }

    if (
      !data
        ?.success
    ) {
      throw new Error(
        data
          ?.message ||
        "Inventory request failed.",
      );
    }

    return data;
  }


  async function initialize() {
    setLoading(
      true,
    );

    setErrorMessage(
      "",
    );

    try {
      const setup =
        await invoke(
          {
            action:
              "LIST_SETUP",

            client_id:
              client
                .client_id,
          },
        );

      setOwners(
        setup
          .owners ||
        [],
      );

      setOwnerTypes(
        setup
          .owner_types ||
        [],
      );

      await loadItems();
    } catch (
      error
    ) {
      setErrorMessage(
        error
          ?.message ||
        "Unable to load inventory.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }


  async function loadItems(
    overrides =
      {},
  ) {
    const activeSearch =
      overrides
        .search ??
      search;

    const activeStatus =
      overrides
        .status ??
      statusFilter;

    const data =
      await invoke(
        {
          action:
            "LIST_ITEMS",

          client_id:
            client
              .client_id,

          search:
            activeSearch,

          status:
            activeStatus,
        },
      );

    setItems(
      data
        .items ||
      [],
    );
  }


  async function refreshAll() {
    setProcessing(
      true,
    );

    setMessage(
      "",
    );

    setErrorMessage(
      "",
    );

    try {
      await initialize();

      setMessage(
        "Inventory refreshed.",
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error
          ?.message ||
        "Unable to refresh inventory.",
      );
    } finally {
      setProcessing(
        false,
      );
    }
  }


  const defaultOwner =
    useMemo(
      () =>
        owners.find(
          (
            owner,
          ) =>
            owner
              .is_default ===
            true,
        ) ||
        owners[
          0
        ] ||
        null,
      [
        owners,
      ],
    );


  const summary =
    useMemo(
      () => {
        return items.reduce(
          (
            result,
            item,
          ) => {
            result
              .items +=
              1;

            result
              .onHand +=
              Number(
                item
                  .qty_on_hand ||
                0,
              );

            result
              .reserved +=
              Number(
                item
                  .qty_reserved ||
                0,
              );

            result
              .available +=
              Number(
                item
                  .qty_available ||
                0,
              );

            return result;
          },
          {
            items:
              0,

            onHand:
              0,

            reserved:
              0,

            available:
              0,
          },
        );
      },
      [
        items,
      ],
    );


  function openNewItem() {
    setItemForm(
      {
        ...EMPTY_ITEM,

        inventory_owner_id:
          defaultOwner
            ?.inventory_owner_id ||
          "",
      },
    );

    setItemModal(
      true,
    );

    setMessage(
      "",
    );

    setErrorMessage(
      "",
    );
  }


  function openEditItem(
    item,
  ) {
    setItemForm(
      {
        inventory_item_id:
          item
            .inventory_item_id,

        inventory_owner_id:
          item
            .inventory_owner_id ||
          "",

        item_code:
          item
            .item_code ||
          "",

        item_name:
          item
            .item_name ||
          "",

        description:
          item
            .description ||
          "",

        default_selling_price:
          String(
            item
              .default_selling_price ??
            "",
          ),

        opening_quantity:
          "",

        status:
          item
            .status ||
          "ACTIVE",
      },
    );

    setItemModal(
      true,
    );
  }


  async function saveItem() {
    const code =
      String(
        itemForm
          .item_code ||
        "",
      )
        .trim();

    const name =
      String(
        itemForm
          .item_name ||
        "",
      )
        .trim();

    if (
      !code ||
      !name
    ) {
      setErrorMessage(
        "Item Code and Item Name are required.",
      );

      return;
    }

    setProcessing(
      true,
    );

    setMessage(
      "",
    );

    setErrorMessage(
      "",
    );

    try {
      await invoke(
        {
          action:
            "SAVE_ITEM",

          client_id:
            client
              .client_id,

          ...itemForm,
        },
      );

      setItemModal(
        false,
      );

      await loadItems();

      setMessage(
        itemForm
          .inventory_item_id
          ? "Inventory item updated."
          : "Inventory item created.",
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error
          ?.message ||
        "Unable to save inventory item.",
      );
    } finally {
      setProcessing(
        false,
      );
    }
  }


  async function createOwner() {
    if (
      !String(
        ownerForm
          .owner_name ||
        "",
      )
        .trim()
    ) {
      setErrorMessage(
        "Owner name is required.",
      );

      return;
    }

    setProcessing(
      true,
    );

    setMessage(
      "",
    );

    setErrorMessage(
      "",
    );

    try {
      const data =
        await invoke(
          {
            action:
              "CREATE_OWNER",

            client_id:
              client
                .client_id,

            ...ownerForm,
          },
        );

      const setup =
        await invoke(
          {
            action:
              "LIST_SETUP",

            client_id:
              client
                .client_id,
          },
        );

      setOwners(
        setup
          .owners ||
        [],
      );

      setOwnerTypes(
        setup
          .owner_types ||
        [],
      );

      setItemForm(
        (
          current,
        ) => ({
          ...current,

          inventory_owner_id:
            data
              .owner
              .inventory_owner_id,
        }),
      );

      setOwnerForm(
        {
          ...EMPTY_OWNER,
        },
      );

      setOwnerModal(
        false,
      );

      setMessage(
        "Inventory owner added.",
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error
          ?.message ||
        "Unable to create owner.",
      );
    } finally {
      setProcessing(
        false,
      );
    }
  }


  function openStock(
    item,
  ) {
    setSelectedItem(
      item,
    );

    setStockForm(
      {
        movement_type_code:
          "RECEIPT",

        quantity:
          "",

        remarks:
          "",
      },
    );

    setStockModal(
      true,
    );
  }


  async function adjustStock() {
    const quantityValue =
      Number(
        stockForm
          .quantity,
      );

    if (
      !Number.isFinite(
        quantityValue,
      ) ||
      quantityValue <=
        0
    ) {
      setErrorMessage(
        "Stock quantity must be greater than zero.",
      );

      return;
    }

    setProcessing(
      true,
    );

    setMessage(
      "",
    );

    setErrorMessage(
      "",
    );

    try {
      await invoke(
        {
          action:
            "ADJUST_STOCK",

          client_id:
            client
              .client_id,

          inventory_item_id:
            selectedItem
              .inventory_item_id,

          ...stockForm,
        },
      );

      setStockModal(
        false,
      );

      await loadItems();

      setMessage(
        "Stock updated successfully.",
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error
          ?.message ||
        "Unable to update stock.",
      );
    } finally {
      setProcessing(
        false,
      );
    }
  }


  function openImages(
    item,
  ) {
    setSelectedItem(
      item,
    );

    setImageModal(
      true,
    );
  }


  async function uploadImages(
    fileList,
  ) {
    const files =
      Array.from(
        fileList ||
        [],
      );

    if (
      !files.length ||
      !selectedItem
        ?.inventory_item_id
    ) {
      return;
    }

    setProcessing(
      true,
    );

    setMessage(
      "",
    );

    setErrorMessage(
      "",
    );

    try {
      const hasExistingPrimary =
        (
          selectedItem
            .images ||
          []
        )
          .some(
            (
              image,
            ) =>
              image
                .is_primary ===
              true,
          );

      for (
        let index =
          0;
        index <
        files.length;
        index++
      ) {
        const form =
          new FormData();

        form.append(
          "action",
          "UPLOAD_IMAGE",
        );

        form.append(
          "client_id",
          client
            .client_id,
        );

        form.append(
          "inventory_item_id",
          selectedItem
            .inventory_item_id,
        );

        form.append(
          "is_primary",
          String(
            !hasExistingPrimary &&
            index ===
              0,
          ),
        );

        form.append(
          "file",
          files[
            index
          ],
          files[
            index
          ].name,
        );

        const {
          data,
          error,
        } =
          await supabase
            .functions
            .invoke(
              "inventory-admin",
              {
                body:
                  form,
              },
            );

        if (error) {
          throw error;
        }

        if (
          !data
            ?.success
        ) {
          throw new Error(
            data
              ?.message ||
            "Image upload failed.",
          );
        }
      }

      const refreshed =
        await invoke(
          {
            action:
              "GET_ITEM",

            client_id:
              client
                .client_id,

            inventory_item_id:
              selectedItem
                .inventory_item_id,
          },
        );

      setSelectedItem(
        refreshed
          .item,
      );

      await loadItems();

      setMessage(
        `${files.length} image(s) uploaded.`,
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error
          ?.message ||
        "Unable to upload inventory image.",
      );
    } finally {
      if (
        imageInputRef
          .current
      ) {
        imageInputRef
          .current
          .value =
          "";
      }

      setProcessing(
        false,
      );
    }
  }


  function downloadTemplate() {
    const csv =
      [
        [
          "Item Code",
          "Item Name",
          "Description",
          "Price",
          "Quantity",
          "Owner Type",
          "Owner Code",
          "Owner Name",
        ],
        [
          "LUFFY01",
          "Luffy Gear 5",
          "Sample figure",
          "1500",
          "3",
          "OWN",
          "OWN",
          "",
        ],
        [
          "HT001",
          "Hot Toys Iron Man",
          "Consignment sample",
          "8500",
          "1",
          "CONSIGNOR",
          "JUAN01",
          "Juan Dela Cruz",
        ],
      ]
        .map(
          (
            row,
          ) =>
            row
              .map(
                (
                  cell,
                ) =>
                  `"${String(
                    cell,
                  )
                    .replaceAll(
                      '"',
                      '""',
                    )}"`,
              )
              .join(
                ",",
              ),
        )
        .join(
          "\n",
        );

    const blob =
      new Blob(
        [
          csv,
        ],
        {
          type:
            "text/csv;charset=utf-8",
        },
      );

    const url =
      URL.createObjectURL(
        blob,
      );

    const anchor =
      document.createElement(
        "a",
      );

    anchor.href =
      url;

    anchor.download =
      "eo2mate-inventory-import-template.csv";

    document
      .body
      .appendChild(
        anchor,
      );

    anchor.click();

    anchor.remove();

    URL.revokeObjectURL(
      url,
    );
  }


  async function previewImport(
    file,
  ) {
    if (!file) {
      return;
    }

    setProcessing(
      true,
    );

    setMessage(
      "",
    );

    setErrorMessage(
      "",
    );

    try {
      const form =
        new FormData();

      form.append(
        "action",
        "IMPORT_PREVIEW",
      );

      form.append(
        "client_id",
        client
          .client_id,
      );

      form.append(
        "duplicate_strategy",
        duplicateStrategy,
      );

      form.append(
        "file",
        file,
        file.name,
      );

      const {
        data,
        error,
      } =
        await supabase
          .functions
          .invoke(
            "inventory-admin",
            {
              body:
                form,
            },
          );

      if (error) {
        throw error;
      }

      if (
        !data
          ?.success
      ) {
        throw new Error(
          data
            ?.message ||
          "Unable to validate import file.",
        );
      }

      setImportPreview(
        data,
      );

      setImportModal(
        true,
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error
          ?.message ||
        "Unable to preview inventory import.",
      );
    } finally {
      if (
        importInputRef
          .current
      ) {
        importInputRef
          .current
          .value =
          "";
      }

      setProcessing(
        false,
      );
    }
  }


  async function commitImport() {
    if (
      !importPreview
        ?.batch
        ?.inventory_import_batch_id
    ) {
      return;
    }

    if (
      Number(
        importPreview
          .batch
          .error_rows ||
        0,
      ) >
      0
    ) {
      setErrorMessage(
        "Fix the rows with errors before importing.",
      );

      return;
    }

    setProcessing(
      true,
    );

    setMessage(
      "",
    );

    setErrorMessage(
      "",
    );

    try {
      const result =
        await invoke(
          {
            action:
              "IMPORT_COMMIT",

            client_id:
              client
                .client_id,

            inventory_import_batch_id:
              importPreview
                .batch
                .inventory_import_batch_id,
          },
        );

      setImportModal(
        false,
      );

      setImportPreview(
        null,
      );

      await loadItems();

      const setup =
        await invoke(
          {
            action:
              "LIST_SETUP",

            client_id:
              client
                .client_id,
          },
        );

      setOwners(
        setup
          .owners ||
        [],
      );

      setMessage(
        `Bulk import completed. ${result.imported_rows} row(s) imported.`,
      );
    } catch (
      error
    ) {
      setErrorMessage(
        error
          ?.message ||
        "Unable to import inventory.",
      );
    } finally {
      setProcessing(
        false,
      );
    }
  }


  async function runSearch(
    event,
  ) {
    event
      ?.preventDefault?.();

    setProcessing(
      true,
    );

    try {
      await loadItems();
    } catch (
      error
    ) {
      setErrorMessage(
        error
          ?.message ||
        "Unable to search inventory.",
      );
    } finally {
      setProcessing(
        false,
      );
    }
  }


  return (
    <>
      <style>{`
        .inventory-page {
          display: grid;
          gap: 18px;
        }

        .inventory-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .inventory-toolbar-actions {
          display: flex;
          gap: 9px;
          flex-wrap: wrap;
        }

        .inventory-summary {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(140px, 1fr));
          gap: 12px;
        }

        .inventory-summary-card {
          padding: 16px;
          border: 1px solid rgba(148,163,184,.20);
          border-radius: 16px;
          background: rgba(148,163,184,.035);
        }

        .inventory-summary-card span {
          display: block;
          font-size: .74rem;
          text-transform: uppercase;
          letter-spacing: .06em;
          opacity: .58;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .inventory-summary-card strong {
          display: block;
          font-size: 1.45rem;
          line-height: 1;
          letter-spacing: -.03em;
        }

        .inventory-filter-grid {
          display: grid;
          grid-template-columns:
            minmax(220px, 1fr) minmax(160px, .35fr) auto;
          gap: 10px;
          align-items: end;
        }

        .inventory-page label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: .82rem;
          font-weight: 700;
        }

        .inventory-page input,
        .inventory-page select,
        .inventory-page textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(148,163,184,.38);
          border-radius: 12px;
          min-height: 45px;
          padding: 10px 12px;
          background: rgba(255,255,255,.96);
          color: #111827;
          font: inherit;
          outline: none;
        }

        .inventory-page textarea {
          min-height: 100px;
          resize: vertical;
        }

        .inventory-page input:focus,
        .inventory-page select:focus,
        .inventory-page textarea:focus {
          border-color: var(--accent-color, #2563eb);
          box-shadow: 0 0 0 3px color-mix(
            in srgb,
            var(--accent-color, #2563eb) 14%,
            transparent
          );
        }

        .inventory-card-grid {
          display: grid;
          grid-template-columns:
            repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
        }

        .inventory-item-card {
          border: 1px solid rgba(148,163,184,.20);
          border-radius: 17px;
          overflow: hidden;
          background: rgba(255,255,255,.025);
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .inventory-item-image {
          aspect-ratio: 16 / 10;
          background: rgba(148,163,184,.08);
          display: grid;
          place-items: center;
          overflow: hidden;
        }

        .inventory-item-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .inventory-image-placeholder {
          display: grid;
          place-items: center;
          gap: 4px;
          opacity: .52;
          text-align: center;
          padding: 20px;
        }

        .inventory-item-body {
          padding: 15px;
          display: grid;
          gap: 12px;
        }

        .inventory-item-title {
          display: flex;
          gap: 10px;
          justify-content: space-between;
          align-items: flex-start;
        }

        .inventory-item-title h3 {
          margin: 0;
          font-size: 1rem;
        }

        .inventory-item-code {
          display: inline-block;
          margin-top: 4px;
          font-size: .76rem;
          font-weight: 800;
          letter-spacing: .04em;
          opacity: .62;
        }

        .inventory-owner-line {
          font-size: .79rem;
          opacity: .67;
        }

        .inventory-stock-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
        }

        .inventory-stock-cell {
          padding: 9px;
          border-radius: 11px;
          background: rgba(148,163,184,.07);
          text-align: center;
          min-width: 0;
        }

        .inventory-stock-cell span {
          display: block;
          font-size: .65rem;
          text-transform: uppercase;
          letter-spacing: .05em;
          opacity: .56;
          font-weight: 800;
        }

        .inventory-stock-cell strong {
          display: block;
          margin-top: 3px;
          font-size: 1.05rem;
        }

        .inventory-card-actions {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
        }

        .inventory-status {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: .69rem;
          font-weight: 800;
          letter-spacing: .04em;
        }

        .inventory-status-good {
          background: rgba(22,163,74,.12);
          color: #15803d;
        }

        .inventory-status-warn {
          background: rgba(217,119,6,.12);
          color: #b45309;
        }

        .inventory-status-bad {
          background: rgba(220,38,38,.12);
          color: #b91c1c;
        }

        .inventory-status-muted {
          background: rgba(100,116,139,.12);
          color: #64748b;
        }

        .inventory-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9900;
          background: rgba(15,23,42,.58);
          backdrop-filter: blur(3px);
          display: grid;
          place-items: center;
          padding: 20px;
        }

        .inventory-modal {
          width: min(760px, 96vw);
          max-height: 88vh;
          overflow: auto;
          border-radius: 18px;
          padding: 22px;
          background: var(--panel-bg, #fff);
          color: var(--text-color, #111827);
          box-shadow: 0 24px 70px rgba(0,0,0,.30);
        }

        .inventory-modal-wide {
          width: min(1100px, 96vw);
        }

        .inventory-modal-header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .inventory-modal-header h2 {
          margin: 0 0 4px;
        }

        .inventory-modal-header p {
          margin: 0;
          opacity: .65;
        }

        .inventory-form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 13px;
        }

        .inventory-form-wide {
          grid-column: 1 / -1;
        }

        .inventory-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          flex-wrap: wrap;
          margin-top: 18px;
        }

        .inventory-owner-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 8px;
          align-items: end;
        }

        .inventory-image-grid {
          display: grid;
          grid-template-columns:
            repeat(auto-fill, minmax(140px, 1fr));
          gap: 10px;
          margin-top: 15px;
        }

        .inventory-image-tile {
          border: 1px solid rgba(148,163,184,.20);
          border-radius: 13px;
          overflow: hidden;
          background: rgba(148,163,184,.05);
        }

        .inventory-image-tile img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          display: block;
        }

        .inventory-image-meta {
          padding: 7px 9px;
          font-size: .72rem;
        }

        .inventory-import-summary {
          display: grid;
          grid-template-columns:
            repeat(4, minmax(100px, 1fr));
          gap: 8px;
          margin-bottom: 14px;
        }

        .inventory-import-summary > div {
          border: 1px solid rgba(148,163,184,.20);
          border-radius: 11px;
          padding: 10px;
          text-align: center;
        }

        .inventory-import-table-wrap {
          overflow-x: auto;
          border: 1px solid rgba(148,163,184,.18);
          border-radius: 13px;
        }

        .inventory-import-table {
          width: 100%;
          border-collapse: collapse;
          font-size: .8rem;
        }

        .inventory-import-table th,
        .inventory-import-table td {
          padding: 9px 10px;
          border-bottom: 1px solid rgba(148,163,184,.13);
          text-align: left;
          white-space: nowrap;
        }

        .inventory-busy {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: grid;
          place-items: center;
          background: rgba(15,23,42,.48);
          backdrop-filter: blur(2px);
        }

        .inventory-busy-card {
          width: min(400px, 92vw);
          border-radius: 18px;
          padding: 24px;
          text-align: center;
          background: var(--panel-bg, #fff);
          color: var(--text-color, #111827);
        }

        .inventory-spinner {
          width: 42px;
          height: 42px;
          margin: 0 auto 13px;
          border-radius: 50%;
          border: 4px solid rgba(148,163,184,.30);
          border-top-color: currentColor;
          animation: invSpin .8s linear infinite;
        }

        @keyframes invSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (prefers-color-scheme: dark) {
          .inventory-page input,
          .inventory-page select,
          .inventory-page textarea {
            background: rgba(15,23,42,.58);
            color: #f8fafc;
          }
        }

        @media (max-width: 760px) {
          .inventory-summary {
            grid-template-columns: repeat(2, 1fr);
          }

          .inventory-filter-grid,
          .inventory-form-grid {
            grid-template-columns: 1fr;
          }

          .inventory-form-wide {
            grid-column: auto;
          }

          .inventory-owner-row {
            grid-template-columns: 1fr;
          }

          .inventory-import-summary {
            grid-template-columns: repeat(2, 1fr);
          }

          .inventory-page input,
          .inventory-page select,
          .inventory-page textarea {
            font-size: 16px;
          }
        }
      `}</style>

      <main className="inventory-page">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">
              EO2MATE · INVENTORY
            </p>

            <h1>
              Central Inventory
            </h1>

            <p>
              Manage own stock, consignor items, images, quantities,
              reservations and bulk uploads.
            </p>
          </div>

          <button
            type="button"
            className="icon-button refresh-icon-button"
            onClick={
              refreshAll
            }
            disabled={
              loading ||
              processing
            }
            title="Refresh inventory"
            aria-label="Refresh inventory"
          >
            ↻
          </button>
        </header>


        {
          message &&
          (
            <div className="success-message global-error">
              {
                message
              }
            </div>
          )
        }


        {
          errorMessage &&
          (
            <div className="dashboard-error global-error">
              {
                errorMessage
              }
            </div>
          )
        }


        <section className="inventory-summary">
          <div className="inventory-summary-card">
            <span>
              Items
            </span>

            <strong>
              {
                summary
                  .items
              }
            </strong>
          </div>

          <div className="inventory-summary-card">
            <span>
              On Hand
            </span>

            <strong>
              {
                qty(
                  summary
                    .onHand,
                )
              }
            </strong>
          </div>

          <div className="inventory-summary-card">
            <span>
              Reserved
            </span>

            <strong>
              {
                qty(
                  summary
                    .reserved,
                )
              }
            </strong>
          </div>

          <div className="inventory-summary-card">
            <span>
              Available
            </span>

            <strong>
              {
                qty(
                  summary
                    .available,
                )
              }
            </strong>
          </div>
        </section>


        <section className="dashboard-panel">
          <div className="inventory-toolbar">
            <div>
              <h2>
                Inventory Items
              </h2>

              <p>
                Search by item code, item name or owner.
              </p>
            </div>

            <div className="inventory-toolbar-actions">
              <select
                value={
                  duplicateStrategy
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDuplicateStrategy(
                      event
                        .target
                        .value,
                    )
                }
                disabled={
                  processing
                }
                title="Existing Item Code handling for bulk upload"
                aria-label="Bulk upload duplicate handling"
                style={{
                  width:
                    "auto",
                  minWidth:
                    150,
                }}
              >
                <option value="SKIP">
                  Skip Existing
                </option>

                <option value="UPDATE">
                  Update Existing
                </option>
              </select>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  downloadTemplate
                }
                disabled={
                  processing
                }
              >
                Download Template
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={
                  () =>
                    importInputRef
                      .current
                      ?.click()
                }
                disabled={
                  processing
                }
              >
                Bulk Upload
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={
                  openNewItem
                }
                disabled={
                  processing
                }
              >
                + Add Item
              </button>
            </div>
          </div>


          <input
            ref={
              importInputRef
            }
            type="file"
            hidden
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={
              (
                event,
              ) =>
                previewImport(
                  event
                    .target
                    .files?.[
                      0
                    ],
                )
            }
          />


          <form
            className="inventory-filter-grid"
            onSubmit={
              runSearch
            }
          >
            <label>
              Search
              <input
                value={
                  search
                }
                onChange={
                  (
                    event,
                  ) =>
                    setSearch(
                      event
                        .target
                        .value,
                    )
                }
                placeholder="Item code, name or owner"
              />
            </label>

            <label>
              Status
              <select
                value={
                  statusFilter
                }
                onChange={
                  async (
                    event,
                  ) => {
                    const next =
                      event
                        .target
                        .value;

                    setStatusFilter(
                      next,
                    );

                    setProcessing(
                      true,
                    );

                    try {
                      await loadItems(
                        {
                          status:
                            next,
                        },
                      );
                    } finally {
                      setProcessing(
                        false,
                      );
                    }
                  }
                }
              >
                <option value="ACTIVE">
                  Active
                </option>

                <option value="INACTIVE">
                  Inactive
                </option>

                <option value="ARCHIVED">
                  Archived
                </option>

                <option value="ALL">
                  All
                </option>
              </select>
            </label>

            <button
              type="submit"
              className="secondary-button"
              disabled={
                processing
              }
            >
              Search
            </button>
          </form>


          {
            loading
              ? (
                <p>
                  Loading inventory…
                </p>
              )
              : items.length
                ? (
                  <div className="inventory-card-grid">
                    {
                      items.map(
                        (
                          item,
                        ) => {
                          const image =
                            primaryImage(
                              item,
                            );

                          return (
                            <article
                              key={
                                item
                                  .inventory_item_id
                              }
                              className="inventory-item-card"
                            >
                              <div className="inventory-item-image">
                                {
                                  image
                                    ?.signed_url
                                    ? (
                                      <img
                                        src={
                                          image
                                            .signed_url
                                        }
                                        alt={
                                          item
                                            .item_name
                                        }
                                      />
                                    )
                                    : (
                                      <div className="inventory-image-placeholder">
                                        <strong>
                                          No image
                                        </strong>

                                        <span>
                                          Add inventory photos
                                        </span>
                                      </div>
                                    )
                                }
                              </div>

                              <div className="inventory-item-body">
                                <div className="inventory-item-title">
                                  <div>
                                    <h3>
                                      {
                                        item
                                          .item_name
                                      }
                                    </h3>

                                    <span className="inventory-item-code">
                                      {
                                        item
                                          .item_code
                                      }
                                    </span>
                                  </div>

                                  <span
                                    className={`inventory-status ${statusClass(
                                      item
                                        .status,
                                    )}`}
                                  >
                                    {
                                      item
                                        .status
                                    }
                                  </span>
                                </div>

                                <div className="inventory-owner-line">
                                  {
                                    item
                                      .owner_type_code ===
                                    "CONSIGNOR"
                                      ? `Consignor: ${item.owner_name}`
                                      : `Owner: ${item.owner_name}`
                                  }
                                </div>

                                <strong>
                                  {
                                    money(
                                      item
                                        .default_selling_price,
                                    )
                                  }
                                </strong>

                                <div className="inventory-stock-grid">
                                  <div className="inventory-stock-cell">
                                    <span>
                                      On Hand
                                    </span>

                                    <strong>
                                      {
                                        qty(
                                          item
                                            .qty_on_hand,
                                        )
                                      }
                                    </strong>
                                  </div>

                                  <div className="inventory-stock-cell">
                                    <span>
                                      Reserved
                                    </span>

                                    <strong>
                                      {
                                        qty(
                                          item
                                            .qty_reserved,
                                        )
                                      }
                                    </strong>
                                  </div>

                                  <div className="inventory-stock-cell">
                                    <span>
                                      Available
                                    </span>

                                    <strong>
                                      {
                                        qty(
                                          item
                                            .qty_available,
                                        )
                                      }
                                    </strong>
                                  </div>
                                </div>

                                <div className="inventory-card-actions">
                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={
                                      () =>
                                        openEditItem(
                                          item,
                                        )
                                    }
                                  >
                                    Edit
                                  </button>

                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={
                                      () =>
                                        openStock(
                                          item,
                                        )
                                    }
                                  >
                                    Stock
                                  </button>

                                  <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={
                                      () =>
                                        openImages(
                                          item,
                                        )
                                    }
                                  >
                                    Images
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        },
                      )
                    }
                  </div>
                )
                : (
                  <div className="fb-upload-empty">
                    <strong>
                      No inventory items found
                    </strong>

                    <span>
                      Add an item manually or upload a CSV/XLSX file.
                    </span>
                  </div>
                )
          }
        </section>
      </main>


      {
        itemModal &&
        (
          <div className="inventory-modal-backdrop">
            <section className="inventory-modal">
              <div className="inventory-modal-header">
                <div>
                  <h2>
                    {
                      itemForm
                        .inventory_item_id
                        ? "Edit Inventory Item"
                        : "Add Inventory Item"
                    }
                  </h2>

                  <p>
                    Manual items can be OWN stock or CONSIGNOR stock.
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={
                    () =>
                      setItemModal(
                        false,
                      )
                  }
                >
                  ×
                </button>
              </div>


              <div className="inventory-form-grid">
                <label>
                  Item Code *
                  <input
                    value={
                      itemForm
                        .item_code
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setItemForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            item_code:
                              event
                                .target
                                .value
                                .toUpperCase(),
                          }),
                        )
                    }
                    disabled={
                      Boolean(
                        itemForm
                          .inventory_item_id,
                      )
                    }
                    placeholder="LUFFY01"
                  />
                </label>

                <label>
                  Item Name *
                  <input
                    value={
                      itemForm
                        .item_name
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setItemForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            item_name:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                    placeholder="Luffy Gear 5"
                  />
                </label>


                <div className="inventory-owner-row inventory-form-wide">
                  <label>
                    Item Owner
                    <select
                      value={
                        itemForm
                          .inventory_owner_id
                      }
                      onChange={
                        (
                          event,
                        ) =>
                          setItemForm(
                            (
                              current,
                            ) => ({
                              ...current,

                              inventory_owner_id:
                                event
                                  .target
                                  .value,
                            }),
                          )
                      }
                    >
                      {
                        owners.map(
                          (
                            owner,
                          ) => (
                            <option
                              key={
                                owner
                                  .inventory_owner_id
                              }
                              value={
                                owner
                                  .inventory_owner_id
                              }
                            >
                              {
                                owner
                                  .owner_type_code ===
                                "CONSIGNOR"
                                  ? `${owner.owner_name} · Consignor`
                                  : `${owner.owner_name} · Own Stock`
                              }
                            </option>
                          ),
                        )
                      }
                    </select>
                  </label>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      () =>
                        setOwnerModal(
                          true,
                        )
                    }
                  >
                    + New Owner
                  </button>
                </div>


                <label>
                  Default Selling Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      itemForm
                        .default_selling_price
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setItemForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            default_selling_price:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  />
                </label>


                {
                  !itemForm
                    .inventory_item_id &&
                  (
                    <label>
                      Opening Quantity
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={
                          itemForm
                            .opening_quantity
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setItemForm(
                              (
                                current,
                              ) => ({
                                ...current,

                                opening_quantity:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                        }
                      />
                    </label>
                  )
                }


                {
                  itemForm
                    .inventory_item_id &&
                  (
                    <label>
                      Status
                      <select
                        value={
                          itemForm
                            .status
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setItemForm(
                              (
                                current,
                              ) => ({
                                ...current,

                                status:
                                  event
                                    .target
                                    .value,
                              }),
                            )
                        }
                      >
                        <option value="ACTIVE">
                          Active
                        </option>

                        <option value="INACTIVE">
                          Inactive
                        </option>

                        <option value="ARCHIVED">
                          Archived
                        </option>
                      </select>
                    </label>
                  )
                }


                <label className="inventory-form-wide">
                  Description
                  <textarea
                    value={
                      itemForm
                        .description
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setItemForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            description:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  />
                </label>
              </div>


              <div className="inventory-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    () =>
                      setItemModal(
                        false,
                      )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    saveItem
                  }
                  disabled={
                    processing
                  }
                >
                  Save Item
                </button>
              </div>
            </section>
          </div>
        )
      }


      {
        ownerModal &&
        (
          <div className="inventory-modal-backdrop">
            <section className="inventory-modal">
              <div className="inventory-modal-header">
                <div>
                  <h2>
                    Add Inventory Owner
                  </h2>

                  <p>
                    Use Consignor for items owned by another person.
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={
                    () =>
                      setOwnerModal(
                        false,
                      )
                  }
                >
                  ×
                </button>
              </div>


              <div className="inventory-form-grid">
                <label>
                  Owner Type
                  <select
                    value={
                      ownerForm
                        .owner_type_code
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setOwnerForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            owner_type_code:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  >
                    {
                      ownerTypes.map(
                        (
                          type,
                        ) => (
                          <option
                            key={
                              type
                                .owner_type_code
                            }
                            value={
                              type
                                .owner_type_code
                            }
                          >
                            {
                              type
                                .owner_type_name
                            }
                          </option>
                        ),
                      )
                    }
                  </select>
                </label>

                <label>
                  Owner Code
                  <input
                    value={
                      ownerForm
                        .owner_code
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setOwnerForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            owner_code:
                              event
                                .target
                                .value
                                .toUpperCase(),
                          }),
                        )
                    }
                    placeholder="JUAN01"
                  />
                </label>

                <label>
                  Owner Name *
                  <input
                    value={
                      ownerForm
                        .owner_name
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setOwnerForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            owner_name:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  />
                </label>

                <label>
                  Contact Name
                  <input
                    value={
                      ownerForm
                        .contact_name
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setOwnerForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            contact_name:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  />
                </label>

                <label>
                  Mobile
                  <input
                    value={
                      ownerForm
                        .mobile_no
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setOwnerForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            mobile_no:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  />
                </label>

                <label>
                  Email
                  <input
                    type="email"
                    value={
                      ownerForm
                        .email
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setOwnerForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            email:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  />
                </label>

                <label className="inventory-form-wide">
                  Notes
                  <textarea
                    value={
                      ownerForm
                        .notes
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setOwnerForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            notes:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  />
                </label>
              </div>


              <div className="inventory-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    () =>
                      setOwnerModal(
                        false,
                      )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    createOwner
                  }
                >
                  Add Owner
                </button>
              </div>
            </section>
          </div>
        )
      }


      {
        stockModal &&
        selectedItem &&
        (
          <div className="inventory-modal-backdrop">
            <section className="inventory-modal">
              <div className="inventory-modal-header">
                <div>
                  <h2>
                    Adjust Stock
                  </h2>

                  <p>
                    {
                      selectedItem
                        .item_code
                    }
                    {" · "}
                    {
                      selectedItem
                        .item_name
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={
                    () =>
                      setStockModal(
                        false,
                      )
                  }
                >
                  ×
                </button>
              </div>


              <div className="inventory-stock-grid">
                <div className="inventory-stock-cell">
                  <span>
                    On Hand
                  </span>

                  <strong>
                    {
                      qty(
                        selectedItem
                          .qty_on_hand,
                      )
                    }
                  </strong>
                </div>

                <div className="inventory-stock-cell">
                  <span>
                    Reserved
                  </span>

                  <strong>
                    {
                      qty(
                        selectedItem
                          .qty_reserved,
                      )
                    }
                  </strong>
                </div>

                <div className="inventory-stock-cell">
                  <span>
                    Available
                  </span>

                  <strong>
                    {
                      qty(
                        selectedItem
                          .qty_available,
                      )
                    }
                  </strong>
                </div>
              </div>


              <div className="inventory-form-grid">
                <label>
                  Adjustment Type
                  <select
                    value={
                      stockForm
                        .movement_type_code
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setStockForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            movement_type_code:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  >
                    <option value="RECEIPT">
                      Stock Receipt
                    </option>

                    <option value="ADJUST_IN">
                      Positive Adjustment
                    </option>

                    <option value="ADJUST_OUT">
                      Negative Adjustment
                    </option>

                    <option value="RETURN">
                      Customer Return
                    </option>
                  </select>
                </label>

                <label>
                  Quantity
                  <input
                    type="number"
                    min="0.0001"
                    step="1"
                    value={
                      stockForm
                        .quantity
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setStockForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            quantity:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  />
                </label>

                <label className="inventory-form-wide">
                  Remarks
                  <textarea
                    value={
                      stockForm
                        .remarks
                    }
                    onChange={
                      (
                        event,
                      ) =>
                        setStockForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            remarks:
                              event
                                .target
                                .value,
                          }),
                        )
                    }
                  />
                </label>
              </div>


              <div className="inventory-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    () =>
                      setStockModal(
                        false,
                      )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    adjustStock
                  }
                >
                  Save Stock Movement
                </button>
              </div>
            </section>
          </div>
        )
      }


      {
        imageModal &&
        selectedItem &&
        (
          <div className="inventory-modal-backdrop">
            <section className="inventory-modal">
              <div className="inventory-modal-header">
                <div>
                  <h2>
                    Inventory Images
                  </h2>

                  <p>
                    {
                      selectedItem
                        .item_code
                    }
                    {" · "}
                    {
                      selectedItem
                        .item_name
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={
                    () =>
                      setImageModal(
                        false,
                      )
                  }
                >
                  ×
                </button>
              </div>


              <input
                ref={
                  imageInputRef
                }
                type="file"
                hidden
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  (
                    event,
                  ) =>
                    uploadImages(
                      event
                        .target
                        .files,
                    )
                }
              />


              <button
                type="button"
                className="primary-button"
                onClick={
                  () =>
                    imageInputRef
                      .current
                      ?.click()
                }
              >
                + Upload Images
              </button>


              <div className="inventory-image-grid">
                {
                  (
                    selectedItem
                      .images ||
                    []
                  ).map(
                    (
                      image,
                    ) => (
                      <div
                        key={
                          image
                            .inventory_image_id
                        }
                        className="inventory-image-tile"
                      >
                        {
                          image
                            .signed_url
                            ? (
                              <img
                                src={
                                  image
                                    .signed_url
                                }
                                alt={
                                  image
                                    .original_file_name ||
                                  selectedItem
                                    .item_name
                                }
                              />
                            )
                            : (
                              <div className="inventory-image-placeholder">
                                Image unavailable
                              </div>
                            )
                        }

                        <div className="inventory-image-meta">
                          {
                            image
                              .is_primary
                              ? "Primary image"
                              : `Image ${image.display_order}`
                          }
                        </div>
                      </div>
                    ),
                  )
                }
              </div>
            </section>
          </div>
        )
      }


      {
        importModal &&
        importPreview &&
        (
          <div className="inventory-modal-backdrop">
            <section className="inventory-modal inventory-modal-wide">
              <div className="inventory-modal-header">
                <div>
                  <h2>
                    Bulk Import Preview
                  </h2>

                  <p>
                    {
                      importPreview
                        .batch
                        .original_file_name
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={
                    () =>
                      setImportModal(
                        false,
                      )
                  }
                >
                  ×
                </button>
              </div>


              <div className="inventory-form-grid">
                <label>
                  Existing Item Codes
                  <select
                    value={
                      duplicateStrategy
                    }
                    disabled
                  >
                    <option value="SKIP">
                      Skip Existing
                    </option>

                    <option value="UPDATE">
                      Update Existing
                    </option>
                  </select>

                  <small>
                    Choose this before selecting the file.
                  </small>
                </label>
              </div>


              <div className="inventory-import-summary">
                <div>
                  <strong>
                    {
                      importPreview
                        .batch
                        .total_rows
                    }
                  </strong>
                  <br />
                  Total
                </div>

                <div>
                  <strong>
                    {
                      importPreview
                        .batch
                        .valid_rows
                    }
                  </strong>
                  <br />
                  Valid
                </div>

                <div>
                  <strong>
                    {
                      importPreview
                        .batch
                        .warning_rows
                    }
                  </strong>
                  <br />
                  Warning
                </div>

                <div>
                  <strong>
                    {
                      importPreview
                        .batch
                        .error_rows
                    }
                  </strong>
                  <br />
                  Error
                </div>
              </div>


              <div className="inventory-import-table-wrap">
                <table className="inventory-import-table">
                  <thead>
                    <tr>
                      <th>
                        Row
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Item Code
                      </th>

                      <th>
                        Item Name
                      </th>

                      <th>
                        Owner
                      </th>

                      <th>
                        Price
                      </th>

                      <th>
                        Qty
                      </th>

                      <th>
                        Message
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {
                      (
                        importPreview
                          .rows ||
                        []
                      ).map(
                        (
                          row,
                        ) => (
                          <tr
                            key={
                              row
                                .row_no
                            }
                          >
                            <td>
                              {
                                row
                                  .row_no
                              }
                            </td>

                            <td>
                              <span
                                className={`inventory-status ${statusClass(
                                  row
                                    .validation_status,
                                )}`}
                              >
                                {
                                  row
                                    .validation_status
                                }
                              </span>
                            </td>

                            <td>
                              {
                                row
                                  .item_code ||
                                "—"
                              }
                            </td>

                            <td>
                              {
                                row
                                  .item_name ||
                                "—"
                              }
                            </td>

                            <td>
                              {
                                row
                                  .owner_type_code ===
                                "CONSIGNOR"
                                  ? (
                                    row
                                      .owner_name ||
                                    row
                                      .owner_code ||
                                    "Consignor"
                                  )
                                  : "Own Stock"
                              }
                            </td>

                            <td>
                              {
                                money(
                                  row
                                    .default_selling_price,
                                )
                              }
                            </td>

                            <td>
                              {
                                qty(
                                  row
                                    .opening_quantity,
                                )
                              }
                            </td>

                            <td>
                              {
                                (
                                  row
                                    .validation_messages ||
                                  []
                                )
                                  .join(
                                    " ",
                                  ) ||
                                "Ready"
                              }
                            </td>
                          </tr>
                        ),
                      )
                    }
                  </tbody>
                </table>
              </div>


              <div className="inventory-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    () => {
                      setImportModal(
                        false,
                      );

                      setImportPreview(
                        null,
                      );
                    }
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  onClick={
                    commitImport
                  }
                  disabled={
                    Number(
                      importPreview
                        .batch
                        .error_rows ||
                      0,
                    ) >
                    0
                  }
                >
                  Confirm Import
                </button>
              </div>
            </section>
          </div>
        )
      }




      {
        processing &&
        (
          <div className="inventory-busy">
            <div className="inventory-busy-card">
              <div className="inventory-spinner" />

              <h2>
                Processing…
              </h2>

              <p>
                Please keep this page open until the inventory operation completes.
              </p>
            </div>
          </div>
        )
      }
    </>
  );
}
