<?php

namespace App\Http\Controllers;

use App\Http\Resources\PublicTransparencyReportResource;
use App\Models\Ong;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicTransparencyReportController extends Controller
{
    private function ong(int $ong): Ong
    {
        return Ong::query()->where('status', 'ATIVA')->findOrFail($ong);
    }

    public function index(int $ong): AnonymousResourceCollection
    {
        return PublicTransparencyReportResource::collection($this->ong($ong)->demonstrativos()
            ->where('status', 'PUBLICADO')->with('ong:id,nome')
            ->orderByDesc('publicado_em')->orderByDesc('id')->paginate(15));
    }

    public function show(int $ong, int $demonstrativo): PublicTransparencyReportResource
    {
        $report = $this->ong($ong)->demonstrativos()->where('status', 'PUBLICADO')
            ->with('ong:id,nome')->findOrFail($demonstrativo);

        return new PublicTransparencyReportResource($report);
    }
}
