<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReportPeriodRequest;
use App\Models\Ong;
use App\Services\OngDashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class OngDashboardController extends Controller
{
    public function index(ReportPeriodRequest $request, OngDashboardService $dashboard): JsonResponse
    {
        Gate::authorize('viewDashboard', Ong::class);

        return response()->json($dashboard->dashboard($request->user()->ong_id, $request->user()->perfil, $request->validated()));
    }
}
