"use client";

import { useDeferredValue, useState } from "react";

import type {
  NormalizedOrder,
  OrdersApiError,
  OrdersApiSuccess,
} from "@/lib/types";

type SortKey =
  | "createdAt"
  | "name"
  | "company"
  | "customer"
  | "country"
  | "totalRevenue"
  | "standardWeightKg"
  | "legacyWeightKg"
  | "differenceKg";

type SortDirection = "asc" | "desc";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type Filters = {
  company: string;
  country: string;
  customer: string;
  search: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function isNonEmptyString(value: string | null): value is string {
  return Boolean(value);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatWeightKg(value: number) {
  return `${value.toFixed(2)} kg`;
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(value);
}

function getItemPreview(order: NormalizedOrder) {
  const preview = order.lineItems
    .slice(0, 2)
    .map((lineItem) => `${lineItem.quantity}x ${lineItem.name}`)
    .join(", ");

  if (order.lineItems.length <= 2) {
    return preview;
  }

  return `${preview} +${order.lineItems.length - 2} more`;
}

function compareOrders(
  left: NormalizedOrder,
  right: NormalizedOrder,
  sort: SortState,
) {
  const direction = sort.direction === "asc" ? 1 : -1;

  switch (sort.key) {
    case "createdAt":
      return (
        (new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()) *
        direction
      );
    case "totalRevenue":
    case "standardWeightKg":
    case "legacyWeightKg":
    case "differenceKg":
      return (left[sort.key] - right[sort.key]) * direction;
    case "name":
    case "company":
    case "customer":
    case "country":
      return (
        (left[sort.key] ?? "").localeCompare(right[sort.key] ?? "", undefined, {
          sensitivity: "base",
        }) * direction
      );
    default:
      return 0;
  }
}

function matchesSearch(order: NormalizedOrder, query: string) {
  if (!query) {
    return true;
  }

  const searchableValues = [
    order.name,
    order.company,
    order.customer,
    order.country,
    ...order.lineItems.flatMap((lineItem) => [
      lineItem.name,
      lineItem.productTitle,
      lineItem.variantTitle,
      lineItem.sku,
    ]),
  ];

  return searchableValues.some((value) => value?.toLowerCase().includes(query));
}

export default function OrdersDashboard({
  initialStartDate,
  initialEndDate,
}: {
  initialStartDate: string;
  initialEndDate: string;
}) {
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [data, setData] = useState<OrdersApiSuccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    company: "",
    country: "",
    customer: "",
    search: "",
  });
  const [sort, setSort] = useState<SortState>({
    key: "createdAt",
    direction: "desc",
  });
  const deferredSearch = useDeferredValue(filters.search.trim().toLowerCase());

  const orders = data?.orders ?? [];
  const companyOptions = Array.from(
    new Set(orders.map((order) => order.company).filter(isNonEmptyString)),
  ).sort((left, right) => left.localeCompare(right));
  const customerOptions = Array.from(
    new Set(orders.map((order) => order.customer).filter(isNonEmptyString)),
  ).sort((left, right) => left.localeCompare(right));
  const countryOptions = Array.from(
    new Set(orders.map((order) => order.country).filter(isNonEmptyString)),
  ).sort((left, right) => left.localeCompare(right));

  const filteredOrders = [...orders]
    .filter((order) =>
      filters.company ? order.company === filters.company : true,
    )
    .filter((order) =>
      filters.customer ? order.customer === filters.customer : true,
    )
    .filter((order) =>
      filters.country ? order.country === filters.country : true,
    )
    .filter((order) => matchesSearch(order, deferredSearch))
    .sort((left, right) => compareOrders(left, right, sort));

  const filteredSummary = {
    orderCount: filteredOrders.length,
    totalStandardWeightKg: filteredOrders.reduce(
      (sum, order) => sum + order.standardWeightKg,
      0,
    ),
    totalLegacyWeightKg: filteredOrders.reduce(
      (sum, order) => sum + order.legacyWeightKg,
      0,
    ),
    totalDifferenceKg: filteredOrders.reduce(
      (sum, order) => sum + order.differenceKg,
      0,
    ),
  };
  const filteredRevenueByCurrency = new Map<string, number>();

  for (const order of filteredOrders) {
    filteredRevenueByCurrency.set(
      order.currencyCode,
      (filteredRevenueByCurrency.get(order.currencyCode) ?? 0) +
        order.totalRevenue,
    );
  }

  const filteredCurrencyBreakdown = Array.from(
    filteredRevenueByCurrency.entries(),
  )
    .map(([currencyCode, totalRevenue]) => ({
      currencyCode,
      totalRevenue,
    }))
    .sort((left, right) => left.currencyCode.localeCompare(right.currencyCode));

  async function loadOrders() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/orders?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
      );
      const result = (await response.json()) as
        | OrdersApiSuccess
        | OrdersApiError;

      if (!response.ok) {
        throw new Error(
          "error" in result
            ? result.details
              ? `${result.error} ${result.details}`
              : result.error
            : "Failed to load orders.",
        );
      }

      if ("error" in result) {
        throw new Error(
          result.details ? `${result.error} ${result.details}` : result.error,
        );
      }

      const nextCompanyOptions = Array.from(
        new Set(
          result.orders.map((order) => order.company).filter(isNonEmptyString),
        ),
      ).sort((left, right) => left.localeCompare(right));
      const nextCustomerOptions = Array.from(
        new Set(
          result.orders.map((order) => order.customer).filter(isNonEmptyString),
        ),
      ).sort((left, right) => left.localeCompare(right));
      const nextCountryOptions = Array.from(
        new Set(
          result.orders.map((order) => order.country).filter(isNonEmptyString),
        ),
      ).sort((left, right) => left.localeCompare(right));

      setData(result);
      setHasLoaded(true);
      setFilters((currentFilters) => ({
        company: nextCompanyOptions.includes(currentFilters.company)
          ? currentFilters.company
          : "",
        country: nextCountryOptions.includes(currentFilters.country)
          ? currentFilters.country
          : "",
        customer: nextCustomerOptions.includes(currentFilters.customer)
          ? currentFilters.customer
          : "",
        search: currentFilters.search,
      }));
    } catch (loadError) {
      setData(null);
      setHasLoaded(true);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load orders.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  function updateFilter<Key extends keyof Filters>(
    key: Key,
    value: Filters[Key],
  ) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  }

  function toggleSort(key: SortKey) {
    setSort((currentSort) => ({
      key,
      direction:
        currentSort.key === key && currentSort.direction === "desc"
          ? "asc"
          : "desc",
    }));
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                B2B Sales Overview
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                Request Shopify orders by date range and review revenue plus
                order weight.
              </h1>
              <p className="text-sm leading-6 text-slate-600">
                This version stays request-driven. It fetches directly from
                Shopify, preserves both weight calculations, and keeps the data
                in memory only.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[32rem]">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>Start date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-slate-700">
                <span>End date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <button
                type="button"
                onClick={loadOrders}
                disabled={isLoading || !startDate || !endDate}
                className="h-11 self-end rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                {isLoading ? "Loading..." : "Load Orders"}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        {data ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Orders</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {filteredSummary.orderCount}
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Revenue</p>
                <div className="mt-3 space-y-1">
                  {filteredCurrencyBreakdown.length === 0 ? (
                    <p className="text-3xl font-semibold text-slate-950">-</p>
                  ) : filteredCurrencyBreakdown.length === 1 ? (
                    <p className="text-3xl font-semibold text-slate-950">
                      {formatCurrency(
                        filteredCurrencyBreakdown[0].totalRevenue,
                        filteredCurrencyBreakdown[0].currencyCode,
                      )}
                    </p>
                  ) : (
                    filteredCurrencyBreakdown.map((entry) => (
                      <p
                        key={entry.currencyCode}
                        className="text-sm font-medium text-slate-950">
                        {formatCurrency(entry.totalRevenue, entry.currencyCode)}
                      </p>
                    ))
                  )}
                </div>
              </article>
              {/* 
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Standard weight</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">
                  {formatWeightKg(filteredSummary.totalStandardWeightKg)}
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Legacy delta</p>
                <p
                  className={`mt-3 text-3xl font-semibold ${
                    filteredSummary.totalDifferenceKg === 0
                      ? "text-slate-950"
                      : filteredSummary.totalDifferenceKg > 0
                        ? "text-amber-700"
                        : "text-emerald-700"
                  }`}>
                  {formatWeightKg(filteredSummary.totalDifferenceKg)}
                </p>
              </article>
               */}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <label className="space-y-2 text-sm font-medium text-slate-700 xl:col-span-2">
                  <span>Search</span>
                  <input
                    type="search"
                    value={filters.search}
                    onChange={(event) =>
                      updateFilter("search", event.target.value)
                    }
                    placeholder="Order number, company, customer, SKU, product..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Company</span>
                  <select
                    value={filters.company}
                    onChange={(event) =>
                      updateFilter("company", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200">
                    <option value="">All companies</option>
                    {companyOptions.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Customer</span>
                  <select
                    value={filters.customer}
                    onChange={(event) =>
                      updateFilter("customer", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
                    disabled={customerOptions.length === 0}>
                    <option value="">
                      {customerOptions.length === 0
                        ? "No customers found"
                        : "All customers"}
                    </option>
                    {customerOptions.map((customer) => (
                      <option key={customer} value={customer}>
                        {customer}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  <span>Country</span>
                  <select
                    value={filters.country}
                    onChange={(event) =>
                      updateFilter("country", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200">
                    <option value="">All countries</option>
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    Orders
                  </h2>
                  <p className="text-sm text-slate-500">
                    {filteredOrders.length} of {orders.length} shown
                  </p>
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-slate-500">
                  No orders match the current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-500">
                        {[
                          { key: "name", label: "Order" },
                          { key: "createdAt", label: "Date" },
                          { key: "company", label: "Company" },
                          { key: "customer", label: "Customer" },
                          { key: "country", label: "Country" },
                          { key: "totalRevenue", label: "Revenue" },
                          { key: "legacyWeightKg", label: "Weight" },
                        ].map((column) => (
                          <th
                            key={column.key}
                            className="px-4 py-3 font-semibold">
                            <button
                              type="button"
                              onClick={() => toggleSort(column.key as SortKey)}
                              className="inline-flex items-center gap-1 transition hover:text-slate-900">
                              {column.label}
                              {sort.key === column.key ? (
                                <span>
                                  {sort.direction === "desc" ? "↓" : "↑"}
                                </span>
                              ) : null}
                            </button>
                          </th>
                        ))}
                        <th className="px-4 py-3 font-semibold">Line items</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="align-top text-slate-700">
                          <td className="px-4 py-4">
                            <div className="font-semibold text-slate-950">
                              {order.name}
                            </div>
                            <div className="text-xs text-slate-500">
                              {order.id}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="px-4 py-4">{order.company ?? "—"}</td>
                          <td className="px-4 py-4">{order.customer ?? "—"}</td>
                          <td className="px-4 py-4">{order.country ?? "—"}</td>
                          <td className="px-4 py-4">
                            {formatCurrency(
                              order.totalRevenue,
                              order.currencyCode,
                            )}
                          </td>
                          {/*
                          <td className="px-4 py-4">
                            {formatWeightKg(order.standardWeightKg)}
                          </td>
                          */}
                          <td className="px-4 py-4">
                            {formatWeightKg(order.legacyWeightKg)}
                          </td>
                          {/*
                          <td
                            className={`px-4 py-4 font-medium ${
                              order.differenceKg === 0
                                ? "text-slate-700"
                                : order.differenceKg > 0
                                  ? "text-amber-700"
                                  : "text-emerald-700"
                            }`}>
                            {formatWeightKg(order.differenceKg)}
                          </td>
                           */}
                          <td className="max-w-xs px-4 py-4 text-slate-500">
                            {getItemPreview(order)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : hasLoaded ? (
          <section className="rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
            No orders were returned for the selected date range.
          </section>
        ) : (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
            Choose a date range, then load the orders from Shopify.
          </section>
        )}
      </main>
    </div>
  );
}
